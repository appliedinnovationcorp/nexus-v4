#!/bin/bash

# Local Security Check Script
# Run this script locally before pushing to catch security issues early

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo -e "${BLUE}🔒 Running Local Security Checks${NC}"
echo "=================================="

# Check if required tools are installed
check_tools() {
    echo -e "\n${BLUE}🔧 Checking required tools...${NC}"
    
    local missing_tools=()
    
    if ! command -v docker &> /dev/null; then
        missing_tools+=("docker")
    fi
    
    if ! command -v trivy &> /dev/null; then
        echo -e "${YELLOW}⚠️  Trivy not found, installing...${NC}"
        # Install Trivy
        curl -sfL https://raw.githubusercontent.com/aquasecurity/trivy/main/contrib/install.sh | sh -s -- -b /usr/local/bin
    fi
    
    if ! command -v hadolint &> /dev/null; then
        echo -e "${YELLOW}⚠️  Hadolint not found, will use Docker version${NC}"
    fi
    
    if [ ${#missing_tools[@]} -ne 0 ]; then
        echo -e "${RED}❌ Missing required tools: ${missing_tools[*]}${NC}"
        exit 1
    fi
    
    echo -e "${GREEN}✅ All required tools available${NC}"
}

# Run dependency audit
dependency_audit() {
    echo -e "\n${BLUE}📦 Running dependency audit...${NC}"
    
    if [ -f "package.json" ]; then
        # Run npm audit
        if pnpm audit --audit-level moderate > audit-results.txt 2>&1; then
            echo -e "${GREEN}✅ No high/critical vulnerabilities in dependencies${NC}"
        else
            echo -e "${RED}❌ Vulnerabilities found in dependencies:${NC}"
            cat audit-results.txt
            echo -e "${YELLOW}Run 'pnpm audit fix' to resolve issues${NC}"
            return 1
        fi
    else
        echo -e "${YELLOW}⚠️  No package.json found, skipping dependency audit${NC}"
    fi
}

# Run secret scanning
secret_scan() {
    echo -e "\n${BLUE}🔍 Scanning for secrets...${NC}"
    
    # Simple secret patterns (basic check)
    local secret_patterns=(
        "password\s*=\s*['\"][^'\"]{8,}['\"]"
        "api[_-]?key\s*=\s*['\"][^'\"]{16,}['\"]"
        "secret\s*=\s*['\"][^'\"]{16,}['\"]"
        "token\s*=\s*['\"][^'\"]{16,}['\"]"
        "AKIA[0-9A-Z]{16}"  # AWS Access Key
        "sk_live_[0-9a-zA-Z]{24}"  # Stripe Live Key
    )
    
    local secrets_found=false
    
    for pattern in "${secret_patterns[@]}"; do
        if grep -r -E "$pattern" . --exclude-dir=node_modules --exclude-dir=.git --exclude="*.md" 2>/dev/null; then
            secrets_found=true
        fi
    done
    
    if [ "$secrets_found" = true ]; then
        echo -e "${RED}❌ Potential secrets found in code!${NC}"
        echo -e "${YELLOW}Please review and remove any hardcoded secrets${NC}"
        return 1
    else
        echo -e "${GREEN}✅ No obvious secrets detected${NC}"
    fi
}

# Run Dockerfile security check
dockerfile_check() {
    echo -e "\n${BLUE}🐳 Checking Dockerfile security...${NC}"
    
    if [ -f "Dockerfile" ]; then
        if command -v hadolint &> /dev/null; then
            hadolint Dockerfile
        else
            docker run --rm -i hadolint/hadolint:latest < Dockerfile
        fi
        echo -e "${GREEN}✅ Dockerfile security check completed${NC}"
    else
        echo -e "${YELLOW}⚠️  No Dockerfile found, skipping Docker security check${NC}"
    fi
}

# Run container vulnerability scan
container_scan() {
    echo -e "\n${BLUE}🔍 Scanning container for vulnerabilities...${NC}"
    
    if [ -f "Dockerfile" ]; then
        # Build image for scanning
        echo "Building image for security scan..."
        docker build -t nexus-security-scan:latest . > /dev/null 2>&1
        
        # Run Trivy scan
        echo "Running Trivy vulnerability scan..."
        if trivy image --severity HIGH,CRITICAL --exit-code 1 nexus-security-scan:latest; then
            echo -e "${GREEN}✅ No high/critical vulnerabilities in container${NC}"
        else
            echo -e "${RED}❌ High/critical vulnerabilities found in container${NC}"
            echo -e "${YELLOW}Please update base images and dependencies${NC}"
            return 1
        fi
        
        # Cleanup
        docker rmi nexus-security-scan:latest > /dev/null 2>&1 || true
    else
        echo -e "${YELLOW}⚠️  No Dockerfile found, skipping container scan${NC}"
    fi
}

# Run infrastructure security check
infrastructure_check() {
    echo -e "\n${BLUE}🏗️  Checking infrastructure security...${NC}"
    
    if [ -d "infrastructure" ]; then
        # Install checkov if not available
        if ! command -v checkov &> /dev/null; then
            echo "Installing Checkov..."
            pip install checkov > /dev/null 2>&1
        fi
        
        # Run Checkov
        if checkov -d infrastructure/ --framework terraform --quiet --compact; then
            echo -e "${GREEN}✅ Infrastructure security checks passed${NC}"
        else
            echo -e "${YELLOW}⚠️  Infrastructure security issues found${NC}"
            echo -e "${YELLOW}Review the issues above and fix critical ones${NC}"
        fi
    else
        echo -e "${YELLOW}⚠️  No infrastructure directory found, skipping infrastructure check${NC}"
    fi
}

# Main execution
main() {
    local exit_code=0
    
    check_tools
    
    # Run all security checks
    dependency_audit || exit_code=1
    secret_scan || exit_code=1
    dockerfile_check || exit_code=1
    container_scan || exit_code=1
    infrastructure_check || exit_code=1
    
    echo -e "\n=================================="
    if [ $exit_code -eq 0 ]; then
        echo -e "${GREEN}🎉 All security checks passed!${NC}"
        echo -e "${GREEN}Your code is ready for commit.${NC}"
    else
        echo -e "${RED}❌ Security issues found!${NC}"
        echo -e "${RED}Please fix the issues above before committing.${NC}"
    fi
    echo "=================================="
    
    exit $exit_code
}

# Run main function
main "$@"
