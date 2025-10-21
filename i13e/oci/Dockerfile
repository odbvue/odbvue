# Dockerfile for OCI CLI with Terraform
FROM python:3.11-slim

LABEL maintainer="OCI Infrastructure Management"
LABEL description="Container with OCI CLI and Terraform for managing Oracle Cloud Infrastructure"

# Install dependencies
RUN apt-get update && apt-get install -y \
    curl \
    unzip \
    wget \
    git \
    bash \
    jq \
    && rm -rf /var/lib/apt/lists/*

# Install OCI CLI
RUN curl -L https://raw.githubusercontent.com/oracle/oci-cli/master/scripts/install/install.sh -o /tmp/install.sh && \
    bash /tmp/install.sh --accept-all-defaults && \
    rm /tmp/install.sh

# Add OCI CLI to PATH
ENV PATH="/root/bin:${PATH}"

# Install Terraform
ARG TERRAFORM_VERSION=1.9.8
RUN wget https://releases.hashicorp.com/terraform/${TERRAFORM_VERSION}/terraform_${TERRAFORM_VERSION}_linux_amd64.zip && \
    unzip terraform_${TERRAFORM_VERSION}_linux_amd64.zip && \
    mv terraform /usr/local/bin/ && \
    rm terraform_${TERRAFORM_VERSION}_linux_amd64.zip

# Verify installations
RUN oci --version && terraform --version

# Copy entrypoint script
COPY entrypoint.sh /usr/local/bin/entrypoint.sh
RUN chmod +x /usr/local/bin/entrypoint.sh

# Set working directory
WORKDIR /workspace

# Default command
ENTRYPOINT ["/usr/local/bin/entrypoint.sh"]
CMD ["DEFAULT"]
