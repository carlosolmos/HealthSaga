.PHONY: install build-local build-docker

install:
	npm install

build-local:
	npm run build

build-docker:
	docker build -t healthsaga:latest .
