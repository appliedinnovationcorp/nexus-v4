# Monitoring and Alerting Configuration

# SNS topic for alerts
resource "aws_sns_topic" "alerts" {
  count = var.enable_monitoring ? 1 : 0

  name              = "${local.cluster_name}-alerts"
  kms_master_key_id = aws_kms_key.sns[0].arn

  tags = local.common_tags
}

# KMS key for SNS encryption
resource "aws_kms_key" "sns" {
  count = var.enable_monitoring ? 1 : 0

  description             = "SNS Encryption Key"
  deletion_window_in_days = 7
  enable_key_rotation     = true

  tags = merge(local.common_tags, {
    Name = "${local.cluster_name}-sns-key"
  })
}

resource "aws_kms_alias" "sns" {
  count = var.enable_monitoring ? 1 : 0

  name          = "alias/${local.cluster_name}-sns"
  target_key_id = aws_kms_key.sns[0].key_id
}

# CloudWatch Dashboard
resource "aws_cloudwatch_dashboard" "main" {
  count = var.enable_monitoring ? 1 : 0

  dashboard_name = "${local.cluster_name}-dashboard"

  dashboard_body = jsonencode({
    widgets = [
      {
        type   = "metric"
        x      = 0
        y      = 0
        width  = 12
        height = 6

        properties = {
          metrics = [
            ["AWS/EKS", "cluster_failed_request_count", "ClusterName", local.cluster_name],
            [".", "cluster_request_total", ".", "."]
          ]
          view    = "timeSeries"
          stacked = false
          region  = var.aws_region
          title   = "EKS Cluster Requests"
          period  = 300
        }
      },
      {
        type   = "metric"
        x      = 0
        y      = 6
        width  = 12
        height = 6

        properties = {
          metrics = [
            ["AWS/RDS", "CPUUtilization", "DBInstanceIdentifier", module.rds.db_instance_identifier],
            [".", "DatabaseConnections", ".", "."],
            [".", "ReadLatency", ".", "."],
            [".", "WriteLatency", ".", "."]
          ]
          view    = "timeSeries"
          stacked = false
          region  = var.aws_region
          title   = "RDS Performance"
          period  = 300
        }
      },
      {
        type   = "metric"
        x      = 0
        y      = 12
        width  = 12
        height = 6

        properties = {
          metrics = [
            ["AWS/ElastiCache", "CPUUtilization", "CacheClusterId", "${aws_elasticache_replication_group.main.replication_group_id}-001"],
            [".", "DatabaseMemoryUsagePercentage", ".", "."],
            [".", "CurrConnections", ".", "."]
          ]
          view    = "timeSeries"
          stacked = false
          region  = var.aws_region
          title   = "Redis Performance"
          period  = 300
        }
      },
      {
        type   = "log"
        x      = 0
        y      = 18
        width  = 24
        height = 6

        properties = {
          query   = "SOURCE '/aws/eks/${local.cluster_name}/cluster'\n| fields @timestamp, @message\n| sort @timestamp desc\n| limit 100"
          region  = var.aws_region
          title   = "EKS Cluster Logs"
          view    = "table"
        }
      }
    ]
  })
}

# CloudWatch Composite Alarm for overall system health
resource "aws_cloudwatch_composite_alarm" "system_health" {
  count = var.enable_monitoring ? 1 : 0

  alarm_name        = "${local.cluster_name}-system-health"
  alarm_description = "Overall system health for ${local.cluster_name}"

  alarm_rule = join(" OR ", [
    "ALARM(${aws_cloudwatch_metric_alarm.database_cpu[0].alarm_name})",
    "ALARM(${aws_cloudwatch_metric_alarm.database_connections[0].alarm_name})",
    "ALARM(${aws_cloudwatch_metric_alarm.redis_cpu[0].alarm_name})",
    "ALARM(${aws_cloudwatch_metric_alarm.redis_memory[0].alarm_name})"
  ])

  alarm_actions = [aws_sns_topic.alerts[0].arn]
  ok_actions    = [aws_sns_topic.alerts[0].arn]

  tags = local.common_tags
}

# CloudWatch Log Groups for application logs
resource "aws_cloudwatch_log_group" "app_logs" {
  name              = "/aws/eks/${local.cluster_name}/application"
  retention_in_days = var.log_retention_days
  kms_key_id        = aws_kms_key.eks.arn

  tags = local.common_tags
}

resource "aws_cloudwatch_log_group" "nginx_logs" {
  name              = "/aws/eks/${local.cluster_name}/nginx"
  retention_in_days = var.log_retention_days
  kms_key_id        = aws_kms_key.eks.arn

  tags = local.common_tags
}

# CloudWatch Insights queries
resource "aws_cloudwatch_query_definition" "error_analysis" {
  count = var.enable_monitoring ? 1 : 0

  name = "${local.cluster_name}-error-analysis"

  log_group_names = [
    aws_cloudwatch_log_group.app_logs.name,
    aws_cloudwatch_log_group.eks_cluster.name
  ]

  query_string = <<EOF
fields @timestamp, @message
| filter @message like /ERROR/
| stats count() by bin(5m)
| sort @timestamp desc
EOF
}

resource "aws_cloudwatch_query_definition" "performance_analysis" {
  count = var.enable_monitoring ? 1 : 0

  name = "${local.cluster_name}-performance-analysis"

  log_group_names = [
    aws_cloudwatch_log_group.app_logs.name
  ]

  query_string = <<EOF
fields @timestamp, @message
| filter @message like /response_time/
| parse @message "response_time=* " as response_time
| stats avg(response_time), max(response_time), min(response_time) by bin(5m)
| sort @timestamp desc
EOF
}

# AWS X-Ray for distributed tracing
resource "aws_xray_sampling_rule" "main" {
  count = var.enable_monitoring ? 1 : 0

  rule_name      = "${local.cluster_name}-sampling-rule"
  priority       = 9000
  version        = 1
  reservoir_size = 1
  fixed_rate     = 0.1
  url_path       = "*"
  host           = "*"
  http_method    = "*"
  service_type   = "*"
  service_name   = "*"
  resource_arn   = "*"

  tags = local.common_tags
}

# CloudWatch Synthetics for uptime monitoring
resource "aws_synthetics_canary" "uptime_check" {
  count = var.enable_monitoring && var.domain_name != "" ? 1 : 0

  name                 = "${local.cluster_name}-uptime-check"
  artifact_s3_location = "s3://${aws_s3_bucket.logs.bucket}/synthetics-artifacts/"
  execution_role_arn   = aws_iam_role.synthetics[0].arn
  handler              = "pageLoadBlueprint.handler"
  zip_file             = "synthetics-canary.zip"
  runtime_version      = "syn-nodejs-puppeteer-6.2"

  schedule {
    expression = "rate(5 minutes)"
  }

  run_config {
    timeout_in_seconds    = 60
    memory_in_mb         = 960
    active_tracing       = true
    environment_variables = {
      URL = "https://${var.domain_name}"
    }
  }

  success_retention_period = 2
  failure_retention_period = 14

  tags = local.common_tags
}

# IAM role for CloudWatch Synthetics
resource "aws_iam_role" "synthetics" {
  count = var.enable_monitoring && var.domain_name != "" ? 1 : 0

  name = "${local.cluster_name}-synthetics-role"

  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Action = "sts:AssumeRole"
        Effect = "Allow"
        Principal = {
          Service = "lambda.amazonaws.com"
        }
      }
    ]
  })

  tags = local.common_tags
}

resource "aws_iam_role_policy_attachment" "synthetics" {
  count = var.enable_monitoring && var.domain_name != "" ? 1 : 0

  role       = aws_iam_role.synthetics[0].name
  policy_arn = "arn:aws:iam::aws:policy/CloudWatchSyntheticsExecutionRolePolicy"
}

# Custom metric filters for application logs
resource "aws_cloudwatch_log_metric_filter" "error_count" {
  count = var.enable_monitoring ? 1 : 0

  name           = "${local.cluster_name}-error-count"
  log_group_name = aws_cloudwatch_log_group.app_logs.name
  pattern        = "[timestamp, request_id, level=\"ERROR\", ...]"

  metric_transformation {
    name      = "ErrorCount"
    namespace = "Nexus/Application"
    value     = "1"
  }
}

resource "aws_cloudwatch_log_metric_filter" "response_time" {
  count = var.enable_monitoring ? 1 : 0

  name           = "${local.cluster_name}-response-time"
  log_group_name = aws_cloudwatch_log_group.app_logs.name
  pattern        = "[timestamp, request_id, level, message, response_time]"

  metric_transformation {
    name      = "ResponseTime"
    namespace = "Nexus/Application"
    value     = "$response_time"
  }
}

# CloudWatch alarms for custom metrics
resource "aws_cloudwatch_metric_alarm" "high_error_rate" {
  count = var.enable_monitoring ? 1 : 0

  alarm_name          = "${local.cluster_name}-high-error-rate"
  comparison_operator = "GreaterThanThreshold"
  evaluation_periods  = "2"
  metric_name         = "ErrorCount"
  namespace           = "Nexus/Application"
  period              = "300"
  statistic           = "Sum"
  threshold           = "10"
  alarm_description   = "This metric monitors application error rate"
  alarm_actions       = [aws_sns_topic.alerts[0].arn]

  tags = local.common_tags
}

resource "aws_cloudwatch_metric_alarm" "high_response_time" {
  count = var.enable_monitoring ? 1 : 0

  alarm_name          = "${local.cluster_name}-high-response-time"
  comparison_operator = "GreaterThanThreshold"
  evaluation_periods  = "2"
  metric_name         = "ResponseTime"
  namespace           = "Nexus/Application"
  period              = "300"
  statistic           = "Average"
  threshold           = "2000"
  alarm_description   = "This metric monitors application response time"
  alarm_actions       = [aws_sns_topic.alerts[0].arn]

  tags = local.common_tags
}
