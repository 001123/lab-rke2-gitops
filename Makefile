# ==============================================================================
# RKE2 GitOps & Infrastructure Automation Makefile
# ==============================================================================

INVENTORY ?= infra/ansible/inventory/hosts.yml
CLUSTER_KUBECONFIG := $(CURDIR)/kubeconfig/rke2.yaml
ANSIBLE_DIR ?= infra/ansible

export ANSIBLE_CONFIG = $(ANSIBLE_DIR)/ansible.cfg

.PHONY: help ping rke2 gitops all nodes pods argocd-password grafana-password monitoring validate sops-encrypt sops-decrypt sync-ca-mac untrust-ca-mac status-ca-mac

help:
	@echo "=================================================================="
	@echo "  RKE2 GitOps & Infrastructure Automation (Ubuntu Server)         "
	@echo "=================================================================="
	@echo "  make ping             - Test SSH connection to nodes via Ansible"
	@echo "  make rke2             - Prepare OS and install RKE2 server"
	@echo "  make gitops           - Bootstrap ArgoCD and Root GitOps App"
	@echo "  make all              - Run full bootstrap (OS + RKE2 + ArgoCD)"
	@echo "  make nodes            - List cluster nodes via kubectl"
	@echo "  make pods             - List all pods across all namespaces"
	@echo "  make argocd-password  - Retrieve initial ArgoCD admin password"
	@echo "  make grafana-password - Retrieve Grafana admin credentials via SOPS"
	@echo "  make monitoring       - Check monitoring stack pods, PVCs & ingress"
	@echo "  make validate         - Validate all Kustomize GitOps manifests"
	@echo "  make sops-encrypt     - Encrypt secrets in infra/ansible with SOPS"
	@echo "  make sops-decrypt     - Decrypt secrets in infra/ansible with SOPS"
	@echo "  make sync-ca-mac      - Export Cluster Root CA & trust in macOS Keychain"
	@echo "  make untrust-ca-mac   - Remove Cluster Root CA from macOS Keychain"
	@echo "  make status-ca-mac    - Check Root CA status in cluster & macOS Keychain"
	@echo "=================================================================="

ping:
	ansible -i $(INVENTORY) all -m ping

rke2:
	ansible-playbook -i $(INVENTORY) $(ANSIBLE_DIR)/playbooks/rke2.yml

gitops:
	ansible-playbook -i $(INVENTORY) $(ANSIBLE_DIR)/playbooks/argocd.yml

all:
	ansible-playbook -i $(INVENTORY) $(ANSIBLE_DIR)/playbooks/site.yml

nodes:
	kubectl --kubeconfig $(CLUSTER_KUBECONFIG) get nodes -o wide

pods:
	kubectl --kubeconfig $(CLUSTER_KUBECONFIG) get pods -A

argocd-password:
	@echo -n "ArgoCD admin password: "
	@kubectl --kubeconfig $(CLUSTER_KUBECONFIG) -n argocd get secret argocd-initial-admin-secret -o jsonpath="{.data.password}" | base64 -d 2>/dev/null || echo "Secret not found or already deleted"
	@echo ""

grafana-password:
	@echo "Grafana Admin Credentials (decrypted via SOPS):"
	@sops -d platform/monitoring/grafana-secret.sops.yaml | grep -E 'admin-user|admin-password'

monitoring:
	kubectl --kubeconfig $(CLUSTER_KUBECONFIG) get pods,pvc,ingress -n monitoring

validate:
	./scripts/validate.sh

sops-encrypt:
	sops --encrypt --in-place $(ANSIBLE_DIR)/inventory/group_vars/all.sops.yml

sops-decrypt:
	sops --decrypt $(ANSIBLE_DIR)/inventory/group_vars/all.sops.yml

sync-ca-mac:
	@./scripts/sync-ca-mac.sh sync

untrust-ca-mac:
	@./scripts/sync-ca-mac.sh untrust

status-ca-mac:
	@./scripts/sync-ca-mac.sh status
