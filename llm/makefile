prettify:
	docker run --rm -v .:/apps alpine/flake8:6.0.0 .

lint:
	docker run --rm -v .:/data cytopia/pycodestyle:2 .

dev:
	docker compose\
		-f ../docker-compose.yml\
		-f ../docker-compose.override.yml\
		run --rm -p 8888:8888 llm ./bin/dev.sh

lock:
	docker run --rm -v $$(pwd)/:/home/user $$(docker build -q --target lock .) pipenv lock

test:
	docker run --rm \$$\(docker build -q --target dev .\) pytest tests
