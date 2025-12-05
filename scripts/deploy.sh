#!/bin/bash

# =============================================================================
# React Gallery Production Deployment Script (GitHub Actions)
# =============================================================================
# This script handles the complete deployment workflow:
# 1. Environment variable setup
# 2. Git operations (add, commit, push)
# 3. GitHub Secrets upload (only if changed)
# 4. Deployment monitoring
#
# Usage: ./scripts/deploy-github.sh [env-file] [--force]
#        --force: Force update GitHub secrets even if unchanged

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
PURPLE='\033[0;35m'
CYAN='\033[0;36m'
NC='\033[0m' # No Color

# Configuration
DEFAULT_ENV_FILE=".env"
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"

# Helper functions
print_header() {
    echo -e "${CYAN}================================${NC}"
    echo -e "${CYAN}$1${NC}"
    echo -e "${CYAN}================================${NC}"
    echo
}

print_step() {
    echo -e "${BLUE}🔄 $1${NC}"
}

print_success() {
    echo -e "${GREEN}✅ $1${NC}"
}

print_warning() {
    echo -e "${YELLOW}⚠️  $1${NC}"
}

print_error() {
    echo -e "${RED}❌ $1${NC}"
}

prompt_yes_no() {
    local prompt="$1"
    local default="${2:-n}"

    if [[ "$default" == "y" ]]; then
        prompt="$prompt [Y/n]: "
    else
        prompt="$prompt [y/N]: "
    fi

    while true; do
        read -p "$prompt" yn
        case $yn in
            [Yy]* ) return 0;;
            [Nn]* ) return 1;;
            "" )
                if [[ "$default" == "y" ]]; then
                    return 0
                else
                    return 1
                fi
                ;;
            * ) echo "Please answer yes or no.";;
        esac
    done
}

check_prerequisites() {
    print_step "Checking prerequisites..."

    # Check if we're in a git repository
    if ! git rev-parse --git-dir > /dev/null 2>&1; then
        print_error "Not in a git repository"
        exit 1
    fi

    # Check if GitHub CLI is installed
    if ! command -v gh &> /dev/null; then
        print_error "GitHub CLI (gh) is not installed"
        echo "Install it from: https://cli.github.com/"
        exit 1
    fi

    # Check if user is authenticated with GitHub
    if ! gh auth status &> /dev/null; then
        print_warning "Not authenticated with GitHub CLI"
        if prompt_yes_no "Would you like to authenticate now?"; then
            gh auth login
        else
            print_error "GitHub authentication required for deployment"
            exit 1
        fi
    fi

    print_success "Prerequisites check passed"
    echo
}

select_env_file() {
    local env_file="$1"

    if [[ -z "$env_file" ]]; then
        echo -e "${YELLOW}Available environment files:${NC}" >&2
        local files=()
        for file in .env* env.*; do
            if [[ -f "$file" && "$file" != ".env.example" ]]; then
                files+=("$file")
                echo "  - $file" >&2
            fi
        done

        if [[ ${#files[@]} -eq 0 ]]; then
            print_warning "No environment files found" >&2
            if prompt_yes_no "Create $DEFAULT_ENV_FILE from template?"; then
                if [[ -f ".env.example" ]]; then
                    cp .env.example "$DEFAULT_ENV_FILE"
                    print_success "Created $DEFAULT_ENV_FILE from template" >&2
                    echo -e "${YELLOW}Please edit $DEFAULT_ENV_FILE with your actual values before continuing${NC}" >&2
                    exit 0
                else
                    print_error "No .env.example template found" >&2
                    exit 1
                fi
            else
                exit 1
            fi
        fi

        echo >&2
        read -p "Enter environment file path [$DEFAULT_ENV_FILE]: " env_file >&2
        env_file="${env_file:-$DEFAULT_ENV_FILE}"
    fi

    if [[ ! -f "$env_file" ]]; then
        print_error "Environment file '$env_file' not found" >&2
        exit 1
    fi

    echo "$env_file"
}

validate_env_file() {
    local env_file="$1"

    print_step "Validating environment file: $env_file"

    # Count total variables and placeholders
    local total_vars=0
    local placeholder_vars=0
    local empty_vars=0

    while IFS= read -r line || [[ -n "$line" ]]; do
        # Skip empty lines and comments
        if [[ -z "$line" || "$line" =~ ^[[:space:]]*# ]]; then
            continue
        fi

        if [[ "$line" =~ ^([^=]+)=(.*)$ ]]; then
            local key="${BASH_REMATCH[1]}"
            local value="${BASH_REMATCH[2]}"

            # Remove quotes
            value=$(echo "$value" | sed 's/^["'\'']\|["'\'']$//g')

            ((total_vars++))

            if [[ -z "$value" ]]; then
                ((empty_vars++))
                print_warning "Empty value for: $key"
            elif [[ "$value" =~ ^(your-|dummy-|test@|localhost) ]]; then
                ((placeholder_vars++))
                print_warning "Placeholder value for: $key"
            fi
        fi
    done < "$env_file"

    echo
    echo -e "${CYAN}Environment File Summary:${NC}"
    echo -e "  Total variables: $total_vars"
    echo -e "  Valid values: $((total_vars - placeholder_vars - empty_vars))"
    echo -e "  Placeholder values: $placeholder_vars"
    echo -e "  Empty values: $empty_vars"
    echo

    if [[ $placeholder_vars -gt 0 || $empty_vars -gt 0 ]]; then
        print_warning "Some variables have placeholder or empty values"
        if ! prompt_yes_no "Continue with deployment anyway?"; then
            print_error "Please update your environment file with actual values"
            exit 1
        fi
    fi

    print_success "Environment file validation completed"
    echo
}

check_git_status() {
    print_step "Checking git status..."

    # Check if there are uncommitted changes
    if ! git diff-index --quiet HEAD --; then
        print_warning "You have uncommitted changes:"
        echo
        git status --porcelain
        echo

        if prompt_yes_no "Would you like to add and commit all changes?"; then
            return 0  # Proceed with git operations
        else
            print_error "Please commit your changes before deploying"
            exit 1
        fi
    else
        print_success "Working directory is clean"
        return 1  # No git operations needed
    fi
}

perform_git_operations() {
    print_step "Performing git operations..."

    # Add all changes
    print_step "Adding all changes..."
    git add .

    # Show what will be committed
    echo -e "${YELLOW}Files to be committed:${NC}"
    git diff --cached --name-status
    echo

    # Get commit message
    local default_message="Deploy: Update React Gallery with latest changes"
    read -p "Enter commit message [$default_message]: " commit_message
    commit_message="${commit_message:-$default_message}"

    # Commit changes
    print_step "Committing changes..."
    git commit -m "$commit_message"

    # Check current branch
    local current_branch=$(git branch --show-current)
    print_step "Current branch: $current_branch"

    # Push changes
    if prompt_yes_no "Push changes to origin/$current_branch?" "y"; then
        print_step "Pushing to origin/$current_branch..."
        git push origin "$current_branch"
        print_success "Changes pushed successfully"
    else
        print_warning "Skipping git push - you'll need to push manually"
    fi

    echo
}

get_env_hash() {
    local env_file="$1"
    # Create a hash of the env file contents (excluding comments and empty lines)
    grep -v '^#' "$env_file" | grep -v '^$' | sort | sha256sum | cut -d' ' -f1
}

compare_secrets() {
    local env_file="$1"
    local changed_vars=()
    local new_vars=()
    local unchanged_count=0

    print_step "Comparing local environment with GitHub secrets..."

    # Get current GitHub secrets
    local github_secrets=$(gh secret list --json name -q '.[].name' 2>/dev/null || echo "")

    # Check if ENV_FILE_HASH secret exists
    local current_hash=$(get_env_hash "$env_file")
    if echo "$github_secrets" | grep -q "^ENV_FILE_HASH$"; then
        print_step "Checking environment file hash..."
        echo -e "${CYAN}Current env file hash: ${current_hash:0:16}...${NC}"
    fi

    # Read environment file and compare
    while IFS= read -r line || [[ -n "$line" ]]; do
        # Skip empty lines and comments
        if [[ -z "$line" || "$line" =~ ^[[:space:]]*# ]]; then
            continue
        fi

        if [[ "$line" =~ ^([^=]+)=(.*)$ ]]; then
            local key="${BASH_REMATCH[1]}"
            local value="${BASH_REMATCH[2]}"

            # Remove quotes from value
            value=$(echo "$value" | sed 's/^["'\'']\|["'\'']$//g')

            # Check if secret exists in GitHub
            if echo "$github_secrets" | grep -q "^$key$"; then
                changed_vars+=("$key")
                ((unchanged_count++))
            else
                # New secret
                new_vars+=("$key")
            fi
        fi
    done < "$env_file"

    # Display comparison results
    echo
    if [[ ${#new_vars[@]} -gt 0 ]]; then
        echo -e "${GREEN}New secrets to add (${#new_vars[@]}):${NC}"
        for var in "${new_vars[@]}"; do
            echo "  + $var"
        done
        echo
    fi

    if [[ $unchanged_count -gt 0 ]]; then
        echo -e "${YELLOW}Existing secrets in GitHub: $unchanged_count${NC}"
        echo -e "${YELLOW}Note: Cannot verify if values changed (GitHub doesn't expose secret values)${NC}"
        echo
    fi

    # Return 0 if there are new variables, 1 if all exist
    if [[ ${#new_vars[@]} -gt 0 ]]; then
        return 0
    else
        return 1
    fi
}

upload_secrets() {
    local env_file="$1"
    local force_update="$2"

    # Check if we should skip the update
    if [[ "$force_update" != "true" ]]; then
        if compare_secrets "$env_file"; then
            print_step "New secrets detected, proceeding with update..."
        else
            print_warning "No new secrets detected in environment file"

            if prompt_yes_no "All secrets already exist in GitHub. Update anyway?" "n"; then
                print_step "Proceeding with secret update..."
            else
                print_success "Skipping secret upload (no changes detected)"
                echo -e "${CYAN}Tip: Use --force flag to force update all secrets${NC}"
                echo
                return
            fi
        fi
    else
        print_step "Force update enabled, uploading all secrets..."
    fi

    print_step "Uploading secrets to GitHub..."

    if [[ -f "$SCRIPT_DIR/setup-github-secrets.sh" ]]; then
        chmod +x "$SCRIPT_DIR/setup-github-secrets.sh"
        "$SCRIPT_DIR/setup-github-secrets.sh" "$env_file"

        # Upload hash of the env file for future comparisons
        local env_hash=$(get_env_hash "$env_file")
        print_step "Storing environment file hash for future comparisons..."
        echo "$env_hash" | gh secret set ENV_FILE_HASH

        print_success "Secrets and environment hash uploaded successfully"
    else
        print_error "setup-github-secrets.sh not found in scripts directory"
        exit 1
    fi

    echo
}

monitor_deployment() {
    print_step "Monitoring deployment..."

    # Get repository info
    local repo=$(gh repo view --json nameWithOwner -q .nameWithOwner)

    print_step "Checking for running workflows..."

    # Wait a moment for workflow to start
    sleep 5

    # Check for recent workflow runs
    local workflow_runs=$(gh run list --limit 3 --json status,conclusion,createdAt,workflowName)

    if [[ -n "$workflow_runs" ]]; then
        echo -e "${CYAN}Recent workflow runs:${NC}"
        echo "$workflow_runs" | jq -r '.[] | "  \(.workflowName): \(.status) (\(.createdAt))"'
        echo

        if prompt_yes_no "Would you like to watch the latest workflow run?"; then
            gh run watch
        fi
    fi

    echo -e "${CYAN}Deployment Links:${NC}"
    echo "  📊 Actions: https://github.com/$repo/actions"
    echo "  🔐 Secrets: https://github.com/$repo/settings/secrets/actions"
    echo "  📋 Repository: https://github.com/$repo"
    echo
}

show_post_deployment_info() {
    print_header "Deployment Complete!"

    echo -e "${GREEN}🎉 Your React Gallery has been deployed!${NC}"
    echo
    echo -e "${CYAN}What happens next:${NC}"
    echo "  1. GitHub Actions will build your Docker image"
    echo "  2. Image will be pushed to Docker Hub"
    echo "  3. Application will be deployed to your Ubuntu server"
    echo "  4. Health checks will verify the deployment"
    echo
    echo -e "${CYAN}Monitoring:${NC}"
    echo "  • Watch GitHub Actions for build progress"
    echo "  • Check your server for the running container"
    echo "  • Verify application health at http://your-server:8080"
    echo
    echo -e "${CYAN}Troubleshooting:${NC}"
    echo "  • Check GitHub Actions logs for build issues"
    echo "  • SSH to server and check container logs: docker logs demo-gallery"
    echo "  • Verify environment variables are set correctly"
    echo
}

main() {
    cd "$PROJECT_ROOT"

    # Parse command line arguments
    local env_file=""
    local force_update="false"

    for arg in "$@"; do
        case $arg in
            --force|-f)
                force_update="true"
                shift
                ;;
            --help|-h)
                echo "Usage: $0 [env-file] [--force]"
                echo ""
                echo "Options:"
                echo "  env-file    Path to environment file (default: .env)"
                echo "  --force,-f  Force update GitHub secrets even if unchanged"
                echo "  --help,-h   Show this help message"
                exit 0
                ;;
            *)
                if [[ -z "$env_file" && ! "$arg" =~ ^- ]]; then
                    env_file="$arg"
                fi
                ;;
        esac
    done

    print_header "React Gallery Production Deployment"

    if [[ "$force_update" == "true" ]]; then
        print_warning "Force update mode enabled"
        echo
    fi

    # Check prerequisites
    check_prerequisites

    # Select and validate environment file
    env_file=$(select_env_file "$env_file")
    validate_env_file "$env_file"

    # Check git status and perform operations if needed
    if check_git_status; then
        perform_git_operations
    fi

    # Upload secrets to GitHub (with force flag)
    upload_secrets "$env_file" "$force_update"

    # Monitor deployment
    monitor_deployment

    # Show post-deployment information
    show_post_deployment_info
}

# Handle script interruption
trap 'echo -e "\n${RED}Deployment interrupted${NC}"; exit 1' INT TERM

# Run main function
main "$@"
