makefile:

venv: venv/bin/activate

clean:
	rm -rf venv

venv/bin/activate: requirements.txt
	virtualenv venv
	. venv/bin/activate; pip install -r requirements.txt

