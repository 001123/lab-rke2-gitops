#!/usr/bin/env bash
# ==============================================================================
# Sync & Trust Cluster Root CA on macOS
# ==============================================================================
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "${SCRIPT_DIR}/.." && pwd)"

# Configuration
SECRET_NAME="lab-root-ca-secret"
SECRET_NAMESPACE="cert-manager"
CA_COMMON_NAME="Lab Internal Root CA"
CERT_DIR="${REPO_ROOT}/certs"
CERT_FILE="${CERT_DIR}/lab-root-ca.crt"
KUBECONFIG_FILE="${REPO_ROOT}/kubeconfig/rke2.yaml"
KEYCHAIN="/Library/Keychains/System.keychain"

# Formatting
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
BOLD='\033[1m'
NC='\033[0m' # No Color

log_info() {
    echo -e "${BLUE}[INFO]${NC} $*"
}

log_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $*"
}

log_warn() {
    echo -e "${YELLOW}[WARN]${NC} $*"
}

log_error() {
    echo -e "${RED}[ERROR]${NC} $*"
}

# 1. Check OS
check_macos() {
    if [[ "$(uname -s)" != "Darwin" ]]; then
        log_error "This script is designed for macOS only. Current OS: $(uname -s)"
        exit 1
    fi
}

# 2. Check Prerequisites
check_prerequisites() {
    if ! command -v kubectl >/dev/null 2>&1; then
        log_error "kubectl is not installed or not in PATH."
        exit 1
    fi

    if ! command -v security >/dev/null 2>&1; then
        log_error "macOS 'security' CLI utility not found."
        exit 1
    fi

    if [[ ! -f "${KUBECONFIG_FILE}" ]]; then
        log_error "Kubeconfig not found at: ${KUBECONFIG_FILE}"
        log_info "Please ensure the cluster is provisioned and kubeconfig is fetched."
        exit 1
    fi
}

# 3. Export Certificate from Kubernetes
export_ca_cert() {
    log_info "Exporting Root CA certificate from Secret '${SECRET_NAME}' (namespace: ${SECRET_NAMESPACE})..."
    mkdir -p "${CERT_DIR}"

    # Extract tls.crt (or ca.crt fallback)
    local cert_data
    cert_data=$(kubectl --kubeconfig "${KUBECONFIG_FILE}" -n "${SECRET_NAMESPACE}" get secret "${SECRET_NAME}" \
        -o jsonpath='{.data.tls\.crt}' 2>/dev/null || true)

    if [[ -z "${cert_data}" ]]; then
        cert_data=$(kubectl --kubeconfig "${KUBECONFIG_FILE}" -n "${SECRET_NAMESPACE}" get secret "${SECRET_NAME}" \
            -o jsonpath='{.data.ca\.crt}' 2>/dev/null || true)
    fi

    if [[ -z "${cert_data}" ]]; then
        log_error "Failed to retrieve certificate data from secret ${SECRET_NAME} in namespace ${SECRET_NAMESPACE}."
        exit 1
    fi

    echo "${cert_data}" | base64 -d > "${CERT_FILE}"

    # Verify certificate content
    if ! openssl x509 -in "${CERT_FILE}" -noout >/dev/null 2>&1; then
        log_error "The exported file is not a valid x509 certificate."
        rm -f "${CERT_FILE}"
        exit 1
    fi

    log_success "Root CA certificate saved to: ${CERT_FILE}"
    local subject
    subject=$(openssl x509 -in "${CERT_FILE}" -noout -subject | sed 's/subject=//')
    local expiry
    expiry=$(openssl x509 -in "${CERT_FILE}" -noout -enddate | sed 's/notAfter=//')
    echo "       Subject: ${subject}"
    echo "       Expires: ${expiry}"
}

# 4. Install & Trust in System Keychain
trust_ca_cert() {
    log_info "Configuring macOS System Keychain trust settings..."

    # If certificate already exists in Keychain, remove old one first to avoid duplicates
    if security find-certificate -c "${CA_COMMON_NAME}" "${KEYCHAIN}" >/dev/null 2>&1; then
        log_warn "Existing certificate for '${CA_COMMON_NAME}' found in Keychain. Updating..."
        sudo security delete-certificate -c "${CA_COMMON_NAME}" "${KEYCHAIN}" 2>/dev/null || true
    fi

    log_info "Adding '${CA_COMMON_NAME}' to System Keychain (admin password may be required)..."
    sudo security add-trusted-cert -d -r trustRoot -k "${KEYCHAIN}" "${CERT_FILE}"

    log_success "Certificate '${CA_COMMON_NAME}' is now trusted in macOS System Keychain!"
    echo ""
    echo -e "${BOLD}==================================================================${NC}"
    echo -e "${GREEN}  Cluster Ingress HTTPS endpoints are now securely trusted on Mac!${NC}"
    echo -e "${BOLD}==================================================================${NC}"
    echo -e "You can now access without SSL warnings:"

    # List active ingresses if possible
    local hosts
    hosts=$(kubectl --kubeconfig "${KUBECONFIG_FILE}" get ingress -A -o jsonpath='{range .items[*]}{range .spec.rules[*]}https://{.host}{"\n"}{end}{end}' 2>/dev/null | sort -u || true)
    if [[ -n "${hosts}" ]]; then
        echo "${hosts}" | while read -r url; do
            echo -e "  - ${BLUE}${url}${NC}"
        done
    fi
    echo ""
    log_info "Tip: If your browser (Chrome/Safari) was already open, you may need to restart it or hard refresh (Cmd+Shift+R)."
}

# 5. Untrust & Remove from Keychain
untrust_ca_cert() {
    log_info "Removing '${CA_COMMON_NAME}' from macOS System Keychain..."
    if security find-certificate -c "${CA_COMMON_NAME}" "${KEYCHAIN}" >/dev/null 2>&1; then
        sudo security delete-certificate -c "${CA_COMMON_NAME}" "${KEYCHAIN}"
        log_success "Certificate '${CA_COMMON_NAME}' successfully removed from System Keychain."
    else
        log_warn "Certificate '${CA_COMMON_NAME}' was not found in System Keychain."
    fi

    if [[ -f "${CERT_FILE}" ]]; then
        rm -f "${CERT_FILE}"
        log_info "Deleted local file: ${CERT_FILE}"
    fi
}

# 6. Status Check
status_ca_cert() {
    echo -e "${BOLD}--- Cluster Secret Status ---${NC}"
    if kubectl --kubeconfig "${KUBECONFIG_FILE}" -n "${SECRET_NAMESPACE}" get secret "${SECRET_NAME}" >/dev/null 2>&1; then
        log_success "Secret '${SECRET_NAME}' exists in namespace '${SECRET_NAMESPACE}'."
    else
        log_error "Secret '${SECRET_NAME}' not found in namespace '${SECRET_NAMESPACE}'."
    fi

    echo -e "\n${BOLD}--- macOS Keychain Status ---${NC}"
    if security find-certificate -c "${CA_COMMON_NAME}" "${KEYCHAIN}" >/dev/null 2>&1; then
        log_success "'${CA_COMMON_NAME}' is present in ${KEYCHAIN}."
    else
        log_warn "'${CA_COMMON_NAME}' is NOT installed in ${KEYCHAIN}."
    fi

    echo -e "\n${BOLD}--- Local File Status ---${NC}"
    if [[ -f "${CERT_FILE}" ]]; then
        log_success "Local cert file exists: ${CERT_FILE}"
        openssl x509 -in "${CERT_FILE}" -noout -subject -dates
    else
        log_warn "Local cert file does not exist (${CERT_FILE}). Run 'make sync-ca-mac' to sync."
    fi
}

# Main Dispatcher
main() {
    check_macos
    check_prerequisites

    local action="${1:-sync}"
    case "${action}" in
        sync)
            export_ca_cert
            trust_ca_cert
            ;;
        untrust)
            untrust_ca_cert
            ;;
        status)
            status_ca_cert
            ;;
        *)
            echo "Usage: $0 {sync|untrust|status}"
            exit 1
            ;;
    esac
}

main "$@"
