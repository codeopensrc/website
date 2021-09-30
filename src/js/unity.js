
module.exports = {

    load: (foldername, fullprojectpath, projectname) => {
        let buildUrl = `${fullprojectpath}/Build`;
        let projectsha = window.GAMES[foldername] || ""
        let config = {
            dataUrl: `${buildUrl}/${foldername}.data.gz?${projectsha}`,
            frameworkUrl: `${buildUrl}/${foldername}.framework.js.gz?${projectsha}`,
            codeUrl: `${buildUrl}/${foldername}.wasm.gz?${projectsha}`,
            streamingAssetsUrl: "StreamingAssets",
            companyName: "codeopensrc",
            productName: projectname,
            productVersion: "1.0",
        };
        let loaderUrl = `${buildUrl}/${foldername}.loader.js?${projectsha}`;

        let container = document.querySelector("#unity-container");
        let canvas = document.querySelector("#unity-canvas");
        let loadingBar = document.querySelector("#unity-loading-bar");
        let progressBarFull = document.querySelector("#unity-progress-bar-full");
        let fullscreenButton = document.querySelector("#unity-fullscreen-button");
        let quitButton = document.querySelector("#unity-quit")

        if (/iPhone|iPad|iPod|Android/i.test(navigator.userAgent)) {
            container.className = "unity-mobile";
            config.devicePixelRatio = 1;
        }
        else {
            canvas.style.width = "1024px";
            canvas.style.height = "768px";
        }
        loadingBar.style.display = "block";

        let script = document.createElement("script");
        script.src = loaderUrl;
        script.addEventListener("load", () => {
            createUnityInstance(canvas, config, (progress) => {
                progressBarFull.style.width = 100 * progress + "%";
            }).then((unityInstance) => {
                loadingBar.style.display = "none";
                let fullscreen = () => {
                    unityInstance.SetFullscreen(1);
                };
                fullscreenButton.addEventListener("click", fullscreen)
                let exit = (e) => {
                    e.preventDefault();
                    event.returnValue = '';
                }
                window.addEventListener("beforeunload", exit)
                let quit = () => {
                    unityInstance.Quit().then(() => {
                        fullscreenButton.removeEventListener('click', fullscreen)
                        quitButton.removeEventListener('click', quit)
                        window.removeEventListener("beforeunload", exit)
                        document.querySelector("#unity-canvas").remove()
                        document.querySelectorAll(`script[src*='${fullprojectpath}']`).forEach((script, i) => script.remove())
                        document.querySelectorAll(`link[href*='${fullprojectpath}']`).forEach((link, i) => link.remove())
                        unityInstance = null
                    });
                }
                quitButton.addEventListener("click", quit)
            }).catch((message) => {
                alert(message);
            });
        });
        document.body.appendChild(script);
    }
}
