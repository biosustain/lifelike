makefile:

# Sets up the environment for Ansible to run
venv: venv/bin/activate

clean:
	rm -rf venv

venv/bin/activate: requirements.txt
	virtualenv venv
	. venv/bin/activate; pip install -r requirements.txt

# Fetches the secrets needed for Ansible vault
vault:
	gsutil cp gs://kg-secrets/.vault_secrets_pw .
