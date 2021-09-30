#!/bin/bash

## grep, echo, sed, tee, awk, git, sha256sum, kubectl  all req in image/os
## all available in alpine/busybox (minus kubectl)

while getopts "a:c:h:i:n:r:t:d" flag; do
    # These become set during 'getopts'  --- $OPTIND $OPTARG
    case "$flag" in
        a) OPT_APPNAME=${OPTARG};;
        c) OPT_CONSUL_NAME=${OPTARG};;
        h) OPT_CONSUL_HOST=${OPTARG};;
        i) OPT_IMAGE=${OPTARG};;
        n) NAMESPACE=${OPTARG};;
        r) OPT_REGISTRY=${OPTARG};;
        t) OPT_TAG=${OPTARG};;
        d) USE_DB="true";;
    esac
done

PROD_SERVICE_NAME="main:"
if [[ -n $USE_DB ]]; then DEV_DB_SERVICE_NAME="db:"; fi

## Get variables based on docker-compose.yml
PROD_IMAGE=$(awk "/${PROD_SERVICE_NAME}$/{getline; print; exit;}" docker-compose.yml)
PROD_PORT=$(awk "/${PROD_SERVICE_NAME}$/{getline; getline; print; exit;}" docker-compose.yml)
PROD_CONSUL_NAME=$(awk "/${PROD_SERVICE_NAME}$/{getline; getline; getline; print; exit;}" docker-compose.yml)

IMAGE=$(echo $PROD_IMAGE | cut -d ":" -f2)
if [[ -n $OPT_IMAGE ]]; then IMAGE=$OPT_IMAGE; fi;

TAG=$(echo $PROD_IMAGE | cut -d ":" -f3)
if [[ -n $OPT_TAG ]]; then TAG=$OPT_TAG; fi;

APPNAME=$(echo $IMAGE | sed -re "s|.*/([^/]*)/.*$|\1|" | sed "s/\./-/g")
if [[ -n $OPT_APPNAME ]]; then APPNAME=$OPT_APPNAME; fi;

CONSUL_NAME=$(echo $PROD_CONSUL_NAME | sed -re 's/.*consul.(.*)".*/\1/')
if [[ -n $OPT_CONSUL_NAME ]]; then CONSUL_NAME=$OPT_CONSUL_NAME; fi;

CONSUL_HOST="172.17.0.1"
if [[ -n $OPT_CONSUL_HOST ]]; then CONSUL_HOST=$OPT_CONSUL_HOST; fi;

if [[ -n $OPT_REGISTRY ]]; then
    IMAGE=$(echo $IMAGE | sed -r "s|^[^/]*/(.*)|$OPT_REGISTRY/\1|g")
fi

IMAGE_PORT=$(echo $PROD_PORT | sed -re 's/.*:([[:digit:]]+)".*/\1/')

COMMIT_SHA=$(git log -1 --format="%H")

REGISTER_SERVICE="false"
[[ $NAMESPACE = "production" ]] && REGISTER_SERVICE="true"

CI_ENVIRONMENT_SLUG=${CI_ENVIRONMENT_SLUG:-"dev"}
CI_PROJECT_PATH_SLUG=${CI_PROJECT_PATH_SLUG:-$APPNAME}
DB_NAME=${MONGO_DB_NAME:-mongo}

echo "APPNAME: $APPNAME"
echo "IMAGE: $IMAGE"
echo "TAG: $TAG"
echo "IMAGE_PORT: $IMAGE_PORT"
echo "CONSUL_NAME: $CONSUL_NAME"

if [[ -f .env ]]; then
    source .env;
else
    echo "No .env found, some variables may not be available in deployment.";
fi

if [[ -n $USE_DB && $NAMESPACE != "production" ]]; then
    DEV_DB_IMAGE=$(awk "/${DEV_DB_SERVICE_NAME}$/{getline; print; exit;}" docker-compose.yml)
    DEV_DB_IMAGE_PORT=$(awk "/${DEV_DB_SERVICE_NAME}$/{getline; getline; print; exit;}" docker-compose.yml)
    DEV_DB_PROTO=$(awk "/[:alpha:]*${DEV_DB_SERVICE_NAME}$/{gsub(/^ +|:/,\"\"); print; exit;}" docker-compose.yml)

    DB_IMAGE=$(echo $DEV_DB_IMAGE | cut -d ":" -f2)
    DB_TAG=$(echo $DEV_DB_IMAGE | cut -d ":" -f3)
    DB_IMAGE_PORT=$(echo $DEV_DB_IMAGE_PORT | sed -re 's/.*:([[:digit:]]+)".*/\1/')
    DB_APPNAME=${APPNAME}-tmpdb
        
    DEV_DATABASE_URL="${DEV_DB_PROTO}://${DB_APPNAME}:${DB_IMAGE_PORT}/${DB_NAME}"

    echo "DB_IMAGE: $DB_IMAGE"
    echo "DB_TAG: $DB_TAG"
    echo "DB_IMAGE_PORT: $DB_IMAGE_PORT"
    echo "DEV_DB_PROTO: $DEV_DB_PROTO"
    echo "DEV_DATABASE_URL: $DEV_DATABASE_URL"
fi

#exit


## Create kubernetes secret for app and create a hash
## Hash is used to force a redeploy on secret change
SECRET_YAML_HASH=`<<EOF tee >(kubectl apply -f - >/dev/null) | sha256sum
apiVersion: v1
kind: Secret
metadata:
  name: $APPNAME
  labels:
    app: $APPNAME
type: Opaque
stringData:
  MONGO_DB_NAME: "${DB_NAME}"
  BLOG_KEY: "${BLOG_KEY}"
  TOKEN_API_SELF_READ: "${TOKEN_API_SELF_READ}"
EOF
`

CONFIG_YAML_HASH=`<<EOF tee >(kubectl apply -f - >/dev/null) | sha256sum
apiVersion: v1
kind: ConfigMap
metadata:
  name: $APPNAME
  labels:
    app: $APPNAME
data:
  CONSUL_SERVICE_NAME:  "${CONSUL_NAME}"
  CONSUL_HOST:          "${CONSUL_HOST}"
  REGISTER_SERVICE:     "${REGISTER_SERVICE}"
  AUTH_URL:             "${AUTH_URL}"
  DEV_DATABASE_URL:     "${DEV_DATABASE_URL}"
  GITLAB_API_URL:       "${GITLAB_API_URL}"
EOF
`

## Create a kubernetes service
## Create a kubernetes deployment
OUTPUT=`kubectl apply -f - <<EOF
apiVersion: v1
kind: Service
metadata:
  name: $APPNAME
  namespace: $NAMESPACE
  labels:
    app: $APPNAME
    env: $CI_ENVIRONMENT_SLUG
  annotations:
    app.gitlab.com/app: $CI_PROJECT_PATH_SLUG
    app.gitlab.com/env: $CI_ENVIRONMENT_SLUG
spec:
  selector:
    app: $APPNAME
  ports:
    - protocol: TCP
      port: 80
      targetPort: $IMAGE_PORT
---
apiVersion: apps/v1
kind: Deployment
metadata:
  name: $APPNAME
  namespace: $NAMESPACE
  labels:
    app: $APPNAME
    env: $CI_ENVIRONMENT_SLUG
  annotations:
    app.gitlab.com/app: $CI_PROJECT_PATH_SLUG
    app.gitlab.com/env: $CI_ENVIRONMENT_SLUG
    configHash: $CONFIG_YAML_HASH
    secretHash: $SECRET_YAML_HASH
    commitSha: $COMMIT_SHA
spec:
  replicas: 1
  selector:
    matchLabels:
      app: $APPNAME
  template:
    metadata:
      labels:
        app: $APPNAME
        env: $CI_ENVIRONMENT_SLUG
      annotations:
        app.gitlab.com/app: $CI_PROJECT_PATH_SLUG
        app.gitlab.com/env: $CI_ENVIRONMENT_SLUG
        configHash: $CONFIG_YAML_HASH
        secretHash: $SECRET_YAML_HASH
        commitSha: $COMMIT_SHA
    spec:
      imagePullSecrets:
      - name: gitlab-registry
      containers:
      - name: $APPNAME
        image: $IMAGE:$TAG
        ports:
        - name: imageport
          containerPort: $IMAGE_PORT
        envFrom:
        - configMapRef:
            name: $APPNAME
        - secretRef:
            name: $APPNAME
        livenessProbe:
          httpGet:
            path: /healthcheck
            port: imageport
            httpHeaders:
              - name: Host
                value: localhost
          failureThreshold: 50
        readinessProbe:
          httpGet:
            path: /healthcheck
            port: imageport
            httpHeaders:
              - name: Host
                value: localhost
          initialDelaySeconds: 5

EOF
`

echo "$OUTPUT"

if [[ $OUTPUT =~ "deployment.apps/$APPNAME unchanged" ]]; then
    echo "======= Deployment was unchanged, forcing update via rollout. ======="
    kubectl rollout restart deploy/$APPNAME
fi

### TODO: Persistant volumes
#        volumes:
#            - temp_data:/data/db

## Create a temp db service and deployment
if [[ -n $USE_DB && $NAMESPACE != "production" ]]; then

	APPNAME=$DB_APPNAME

	CONFIG_YAML_HASH=`<<-EOF tee >(kubectl apply -f - >/dev/null) | sha256sum
	apiVersion: v1
	kind: ConfigMap
	metadata:
	  name: $APPNAME
	  labels:
	    app: $APPNAME
	data:
	  MONGO_INITDB_DATABASE: "${DB_NAME}"
	EOF
	`

	kubectl apply -f - <<-EOF
	apiVersion: v1
	kind: Service
	metadata:
	  name: $APPNAME
	  namespace: $NAMESPACE
	  labels:
	    app: $APPNAME
	    env: $CI_ENVIRONMENT_SLUG
	spec:
	  selector:
	    app: $APPNAME
	  ports:
	    - protocol: TCP
	      port: $DB_IMAGE_PORT
	      targetPort: $DB_IMAGE_PORT
	---
	apiVersion: apps/v1
	kind: Deployment
	metadata:
	  name: $APPNAME
	  namespace: $NAMESPACE
	  labels:
	    app: $APPNAME
	    env: $CI_ENVIRONMENT_SLUG
	  annotations:
	    configHash: $CONFIG_YAML_HASH
	spec:
	  replicas: 1
	  selector:
	    matchLabels:
	      app: $APPNAME
	  template:
	    metadata:
	      labels:
	        app: $APPNAME
	        env: $CI_ENVIRONMENT_SLUG
	      annotations:
	        configHash: $CONFIG_YAML_HASH
	    spec:
	      containers:
	      - name: $APPNAME
	        image: $DB_IMAGE:$DB_TAG
	        ports:
	        - containerPort: $DB_IMAGE_PORT
	        envFrom:
	        - configMapRef:
	            name: $APPNAME
	EOF
fi
