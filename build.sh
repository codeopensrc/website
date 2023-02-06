#!/usr/bin/env bash

###! This build script is 99% intended to be used with skaffold.
###! To build and push as a standalone MANUAL_BUILD_IMAGE must be defined.
###! You must also supply the tag when running using '-t TAG'
#MANUAL_BUILD_IMAGE=${IMAGE_REPO}

### NOTE: A common issue is after the build for one reason or another the image
###  is not loaded or pushed to the registry then attempting to build again.
### Sometimes skaffold 'finds' the image even though its not available, this is
###  due to skaffolds caching mechanism. This can cause 'ErrImagePull' errors.
### A solution is to modify something trivial in the image forcing a rebuild/push.
### If this is undesirable, then update skaffold.yaml's `build` section to include
###  a different tag policy like 'dateTime' can solve the issue
### build:
###   tagPolicy:
###     dateTime: {}
### https://skaffold.dev/docs/pipeline-stages/taggers/

##! IMPORTANT: To build/deploy with remote cluster
##! In skaffold config uncomment 'local.push=true'
##! build:
##!   local:
##!     push: true

BUILDKIT_POD_NAME=buildkitd-0
BUILDKIT_POD_NAMESPACE=buildkitd

BUILD_BASE=base
BUILD_TARGET=src
DOCKERFILE=Dockerfile


while test $# -gt 0; do
    case "$1" in
        -f) shift;
            if [[ -n $1 ]]; then
                DOCKERFILE=$1;
            else
                echo "Empty Dockerfile specified"; exit 1;
            fi
            shift;;
        -b) shift;
            if [[ -n $1 ]]; then
                BUILD_BASE=$1;
            else
                echo "Build base not specified"; exit 1;
            fi
            shift;;
        -r) shift;
            if [[ -n $1 ]]; then
                CI_REGISTRY=$1;
            else
                echo "CI Registry not specified"; exit 1;
            fi
            shift;;
        base|src|prod)
            BUILD_TARGET=$1
            shift;;
        docker|buildx|ctl|remote_buildx)
            BUILD_OPT=$1
            shift;;
        ### Only necessary when building without skaffold
        --push)
            PUSH_IMAGE=true
            shift;;
        ### Absolutely necessary only when building without skaffold
        -t) shift;
            IMAGE=${MANUAL_BUILD_IMAGE}:$1
            shift;;
        *) echo "Incorrect argument or flag used: $1";
           exit 1;;
    esac
done

if [[ -z $BUILD_CONTEXT ]]; then BUILD_CONTEXT=.; fi
if [[ -z $BUILD_OPT ]]; then
    echo "Need builder option:";
    echo "  ./build.sh [docker|buildx|ctl|remote_buildx]";
    exit 1
fi
if [[ -z $IMAGE ]]; then
    echo "No IMAGE found means running without skaffold.";
    echo "Need -t option and define MANUAL_BUILD_IMAGE at top of file:";
    echo "  ./build.sh [docker|buildx|ctl|remote_buildx] -t TAG";
    exit 1
fi
CACHE_FROM_IMAGE=${IMAGE//:*/:cache}

echo "BUILDER OPTION: $BUILD_OPT"
echo "DOCKERFILE: $DOCKERFILE"
echo "BUILD_BASE: $BUILD_BASE"
echo "BUILD_TARGET: $BUILD_TARGET"
echo "BUILD_CONTEXT: $BUILD_CONTEXT"
echo "CI_REGISTRY: $CI_REGISTRY"
echo "IMAGE: $IMAGE"


##! NOTE: Using 'remote_buildx' it is up to the user/k8s operator
##!  to handle namespace/pod permissions and manually cleanup the deployment
##! Namespace MUST exist
REMOTE_BUILDX_BUILDER_NAMESPACE=default
REMOTE_BUILDX_BUILDER_NAME=buildkitd
##! NOTE: Be sure when youre finished building to remove the builder
##!   `docker buildx rm $REMOTE_BUILDX_BUILDER_NAME`


###! 'docker' and 'buildx' are for LOCAL build/deploys to minikube/remote cluster
###! They DO NOT require or launch remote buildkit pods

## This uses local docker daemon
if [[ $BUILD_OPT == "docker" ]]; then
    CURRENT_CONTEXT=$(kubectl config current-context)
    if [[ $CURRENT_CONTEXT != "minikube" ]] && [[ $PUSH_IMAGE != "true" ]]; then
        echo "Current context:  $CURRENT_CONTEXT"
        echo "Switch context to minikube to build+deploy to minikube"
        echo "Uncomment local.push in skaffold to build locally + deploy to remote"
        exit 1
    fi
    if [[ -n $CI_REGISTRY ]]; then
        CI_REGISTRY_OPT="--build-arg=CI_BASE_REGISTRY=$CI_REGISTRY"
    fi

    docker build \
      --build-arg=BUILD_BASE=$BUILD_BASE ${CI_REGISTRY_OPT} \
      --target=${BUILD_TARGET} \
      -f ${DOCKERFILE} \
      -t $IMAGE \
      $BUILD_CONTEXT

    if [[ $PUSH_IMAGE = "true" ]]; then
        docker push $IMAGE
    fi
fi
## To use the local docker daemon with buildkit
if [[ $BUILD_OPT == "buildx" ]]; then
    if [[ $PUSH_IMAGE = "true" ]]; then
        PUSH_IMAGE_OPT="--push";
    else
        PUSH_IMAGE_OPT="--load";
    fi
    CURRENT_CONTEXT=$(kubectl config current-context)
    if [[ $CURRENT_CONTEXT != "minikube" ]] && [[ $PUSH_IMAGE != "true" ]]; then
        echo "Current context:  $CURRENT_CONTEXT"
        echo "Switch context to minikube to build+deploy to minikube"
        echo "Uncomment local.push in skaffold to build locally + deploy to remote"
        exit 1
    fi
    if [[ -n $CI_REGISTRY ]]; then
        CI_REGISTRY_OPT="--build-arg=CI_BASE_REGISTRY=$CI_REGISTRY"
    fi
    docker buildx build \
      --build-arg=BUILD_BASE=$BUILD_BASE ${CI_REGISTRY_OPT} \
      --target=${BUILD_TARGET} \
      -f ${DOCKERFILE} \
      $PUSH_IMAGE_OPT -t $IMAGE \
      $BUILD_CONTEXT
fi


###! 'ctl' and 'remote_buildx' are for REMOTE build/deploys
###! Uncommonly remote build and pull locally to minikube can work too
###! They DO require or launch remote buildkit pods

## This uses a pre-deployed buildkitd pod
if [[ $BUILD_OPT == "ctl" ]]; then
    PUSH_IMAGE_OPT=",push=true"
    if [[ $PUSH_IMAGE != "true" ]]; then
        echo "To use 'build.sh ctl' uncomment local.push config in skaffold"
        exit 1
    fi
    POD_UP=$(kubectl get pod ${BUILDKIT_POD_NAME} -n ${BUILDKIT_POD_NAMESPACE})
    if [[ -z $POD_UP ]]; then
        CURRENT_CONTEXT=$(kubectl config current-context)
        echo "Current context:  $CURRENT_CONTEXT"
        echo "Could not find active buildkit pod using the current context" 
        echo "Be sure the context is correct and a pre-deployed pod is ready" 
        echo "" 
        echo "Use 'build.sh remote_buildx' to use buildx and launch a remote builder" 
        exit 1
    fi
    if [[ -n $CI_REGISTRY ]]; then
        CI_REGISTRY_OPT="--opt build-arg:CI_BASE_REGISTRY=$CI_REGISTRY"
    fi
    buildctl \
      --addr kube-pod://${BUILDKIT_POD_NAME}?namespace=${BUILDKIT_POD_NAMESPACE} \
      build \
      --frontend dockerfile.v0 \
      --local dockerfile=$BUILD_CONTEXT \
      --local context=$BUILD_CONTEXT \
      --opt build-arg:BUILD_BASE=$BUILD_BASE ${CI_REGISTRY_OPT} \
      --opt filename=./${DOCKERFILE} \
      --opt target=${BUILD_TARGET} \
      --import-cache type=registry,ref=${CACHE_FROM_IMAGE} \
      --export-cache type=inline \
      --output type=image,\"name=$IMAGE,${CACHE_FROM_IMAGE}\"${PUSH_IMAGE_OPT}
fi

### This launches a buildkitd deployment into REMOTE_BUILDX_BUILDER_NAMESPACE
### Requires cleanup from k8s operator or 'docker buildx rm REMOTE_BUILDX_BUILDER_NAME'
### Check context/make sure theyre aware if theyre using minikube context
### If they want to build+deploy to minikube, inform use `buildx` 
### Or switch to remote context first if they want to build remotely for minikube
###  (Slow laptop with great internet)
if [[ $BUILD_OPT == "remote_buildx" ]]; then
    PUSH_IMAGE_OPT=",push=true"
    if [[ $PUSH_IMAGE != "true" ]]; then
        echo "In order to use 'build.sh remote_buildx' uncomment local.push config in skaffold"
        exit 1
    fi
    CURRENT_CONTEXT=$(kubectl config current-context)
    if [[ $CURRENT_CONTEXT = "minikube" ]]; then
        echo "Current context:  minikube"
        echo "Use './build.sh buildx' to build and deploy to minikube"
        echo ""
        echo "If you wish to build remotely and pull down to minikube switch your"
        echo " context to the remote context/cluster first."
        echo "Also uncomment 'kubeContext: minikube' in skaffold.yaml"
        exit 1
    fi

    BUILDER_READY=$(docker buildx inspect buildkitd)
    if [[ -z $BUILDER_READY ]]; then
        echo "== Builder 'buildkitd' not found, deploying"
        docker buildx create \
          --driver=kubernetes \
          --bootstrap \
          --name $REMOTE_BUILDX_BUILDER_NAME \
          --driver-opt=namespace=$REMOTE_BUILDX_BUILDER_NAMESPACE \
          --use
    fi
    if [[ -n $CI_REGISTRY ]]; then
        CI_REGISTRY_OPT="--build-arg=CI_BASE_REGISTRY=$CI_REGISTRY"
    fi

    echo "== Builder 'buildkitd' ready"
    docker buildx build \
      --builder $REMOTE_BUILDX_BUILDER_NAME \
      --build-arg=BUILD_BASE=$BUILD_BASE ${CI_REGISTRY_OPT} \
      --target=${BUILD_TARGET}        \
      -f ${DOCKERFILE} \
      --cache-from type=registry,ref=${CACHE_FROM_IMAGE} \
      --cache-to type=inline \
      --output type=image,\"name=$IMAGE,${CACHE_FROM_IMAGE}\"${PUSH_IMAGE_OPT} \
      $BUILD_CONTEXT
fi
