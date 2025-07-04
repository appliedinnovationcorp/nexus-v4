# Post-Mortem: {{incident.title}}

**Incident ID:** {{incident.id}}  
**Date:** {{incident.timeline.detectedAt}}  
**Duration:** {{incident.metrics.totalDuration}} minutes  
**Severity:** {{incident.severity}}  
**Status:** {{incident.status}}  

**Author:** {{postmortem.metadata.author}}  
**Reviewers:** {{#each postmortem.metadata.reviewers}}{{this}}{{#unless @last}}, {{/unless}}{{/each}}  
**Date Created:** {{postmortem.metadata.createdAt}}  

---

## Executive Summary

*Provide a brief, high-level summary of the incident for leadership and stakeholders. Include the impact, root cause, and key actions taken.*

{{postmortem.summary}}

**Key Metrics:**
- **Time to Detect:** {{incident.metrics.timeToDetect}} minutes
- **Time to Acknowledge:** {{incident.metrics.timeToAcknowledge}} minutes  
- **Time to Mitigate:** {{incident.metrics.timeToMitigate}} minutes
- **Time to Resolve:** {{incident.metrics.timeToResolve}} minutes
- **Total Duration:** {{incident.metrics.totalDuration}} minutes

**Impact:**
- **Services Affected:** {{#each postmortem.impact.servicesAffected}}{{this}}{{#unless @last}}, {{/unless}}{{/each}}
- **Users Affected:** {{postmortem.impact.usersAffected}}
- **Revenue Impact:** ${{postmortem.impact.revenueImpact}}
- **SLO Impact:** {{postmortem.impact.sloImpact.length}} SLO(s) breached

---

## Timeline

*Provide a detailed timeline of events during the incident. Include all significant actions, decisions, and communications.*

{{#each postmortem.timeline.events}}
### {{formatDate this.timestamp "MMM dd, yyyy HH:mm:ss"}} UTC - {{capitalize this.type}}
{{this.description}}

{{/each}}

---

## Root Cause Analysis

### Primary Root Cause
{{postmortem.rootCause.primary}}

### Contributing Factors
{{#each postmortem.rootCause.contributing}}
- {{this}}
{{/each}}

### Why Wasn't This Caught Earlier?
{{postmortem.rootCause.detection}}

### How Did This Issue Develop?
{{postmortem.rootCause.development}}

---

## Impact Assessment

### Service Impact
{{#each postmortem.impact.servicesAffected}}
- **{{this}}**: {{lookup ../serviceImpactDetails this}}
{{/each}}

### User Impact
- **Total Users Affected:** {{postmortem.impact.usersAffected}}
- **Impact Duration:** {{postmortem.impact.duration}} minutes
- **User Experience Impact:** {{postmortem.impact.userExperienceDescription}}

### Business Impact
- **Revenue Impact:** ${{postmortem.impact.revenueImpact}}
- **Customer Support Tickets:** {{postmortem.impact.supportTickets}}
- **Reputation Impact:** {{postmortem.impact.reputationImpact}}

### SLO Impact
{{#each postmortem.impact.sloImpact}}
- **{{this.sloId}}**: {{this.budgetConsumed}}% of error budget consumed (Target {{#if this.targetMissed}}❌ MISSED{{else}}✅ Met{{/if}})
{{/each}}

---

## What Went Well

*Highlight positive aspects of the incident response to reinforce good practices.*

{{#each postmortem.whatWentWell}}
- {{this}}
{{/each}}

---

## What Could Be Improved

*Identify areas for improvement in our processes, tools, or systems.*

{{#each postmortem.whatCouldBeImproved}}
- {{this}}
{{/each}}

---

## Action Items

*Specific, actionable items to prevent similar incidents and improve our response capabilities.*

{{#each postmortem.actionItems}}
### {{this.id}}: {{this.description}}
- **Owner:** {{this.owner}}
- **Due Date:** {{formatDate this.dueDate "MMM dd, yyyy"}}
- **Priority:** {{this.priority}}
- **Category:** {{this.category}}
- **Status:** {{this.status}}

{{/each}}

---

## Lessons Learned

*Key takeaways and insights gained from this incident.*

{{#each postmortem.lessonsLearned}}
- {{this}}
{{/each}}

---

## Prevention Measures

### Immediate Actions (Completed)
- List actions already taken to prevent immediate recurrence

### Short-term Actions (1-4 weeks)
- List actions planned for the near term

### Long-term Actions (1-6 months)
- List strategic improvements and investments

---

## Detection and Monitoring Improvements

### Current Monitoring Gaps
- Identify what monitoring could have detected this issue earlier

### Proposed Monitoring Enhancements
- Specific monitoring, alerting, or observability improvements

### SLO Adjustments
- Any changes needed to SLO definitions or thresholds

---

## Communication Assessment

### Internal Communication
- How well did we communicate internally during the incident?
- What communication improvements are needed?

### External Communication
- How well did we communicate with customers and stakeholders?
- What external communication improvements are needed?

---

## Process Improvements

### Incident Response Process
- What worked well in our incident response process?
- What process improvements are needed?

### Escalation Process
- Was escalation appropriate and timely?
- What escalation improvements are needed?

### Documentation and Runbooks
- Were runbooks helpful and up-to-date?
- What documentation improvements are needed?

---

## Technical Improvements

### Architecture Changes
- What architectural changes could prevent similar issues?

### Code Changes
- What code improvements are needed?

### Infrastructure Changes
- What infrastructure improvements are needed?

### Tooling Improvements
- What tooling improvements would help?

---

## Appendices

### Appendix A: Detailed Logs
*Include relevant log snippets, error messages, and technical details*

### Appendix B: Metrics and Graphs
*Include relevant metrics, dashboards, and performance graphs*

### Appendix C: Communication Logs
*Include relevant Slack conversations, emails, and other communications*

### Appendix D: Related Incidents
*List any related or similar incidents for context*

---

## Sign-off

### Author Certification
I certify that this post-mortem accurately represents the incident and our response.

**Author:** {{postmortem.metadata.author}}  
**Date:** {{formatDate postmortem.metadata.createdAt "MMM dd, yyyy"}}

### Review and Approval

{{#each postmortem.metadata.reviewers}}
**Reviewer:** {{this}}  
**Status:** ✅ Approved  
**Date:** {{formatDate ../postmortem.metadata.publishedAt "MMM dd, yyyy"}}

{{/each}}

---

*This post-mortem follows our blameless post-mortem process. The goal is to learn and improve, not to assign blame. All participants acted with the best intentions given the information available at the time.*

**Post-Mortem ID:** {{postmortem.id}}  
**Generated:** {{formatDate postmortem.metadata.createdAt "MMM dd, yyyy HH:mm:ss"}} UTC  
**Last Updated:** {{formatDate postmortem.metadata.updatedAt "MMM dd, yyyy HH:mm:ss"}} UTC
