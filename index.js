window.onload = function () {
    const successMsgElement = document.getElementById("successText");
    const errorMsgElement = document.getElementById("errorText");

    const searchParams = new URLSearchParams(window.location.search);

    for (const [key, value] of searchParams) {
        if (key === "error") {
            errorMsgElement.innerHTML = value;
        } else if (key === "success") {
            successMsgElement.innerHTML = value;
        }
    }
    checkLoginStatus();
};

function registerFormSubmit(event) {
    event.preventDefault();

    const form = document.getElementById("registerForm");
    const email = form.elements["email"].value;
    const username = form.elements["username"].value;
    const password = form.elements["password"].value;

    const successMsgElement = document.getElementById("successText");
    const errorMsgElement = document.getElementById("errorText");

    const formData = {
        email: email,
        username: username,
        password: password,
    };

    fetch("/adduser", {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
            // 'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: JSON.stringify(formData),
    })
        .then((response) => {
            response.json().then((data) => {
                if (data.status.toLowerCase() === "error") {
                    errorMsgElement.innerHTML = data.errorMsg;
                } else {
                    successMsgElement.innerHTML =
                        "User successfully registered, please check your email to verify your account.";
                }
            });
        })
        .catch((error) => {
            errorMsgElement.innerHTML = error;
        });
}

function loginFormSubmit(event) {
    event.preventDefault();

    const form = document.getElementById("loginForm");
    const username = form.elements["username"].value;
    const password = form.elements["password"].value;

    const formDiv = document.getElementsByClassName("formDiv")[0];
    const errorMsgElement = document.getElementById("errorText");
    const wp2Div = document.getElementById("wp2");

    const formData = {
        username: username,
        password: password,
    };

    fetch("/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(formData),
    })
        .then((res) => {
            if (!res.ok) {
                res.json().then((data) => {
                    errorMsgElement.innerHTML = data.errorMsg;
                    wp2Div.style.display = "none";
                });
            } else {
                // hide login form, show wp2 div
                wp2Div.style.display = "block";
                formDiv.style.display = "none";
                errorMsgElement.innerHTML = "";
            }
        })
        .catch((err) => {
            errorMsgElement.innerHTML = err;
        });
}

function logout(event) {
    event.preventDefault();

    const formDiv = document.getElementsByClassName("formDiv")[0];
    const radioForm = document.getElementById("radioForm");
    const wp2Div = document.getElementById("wp2");

    fetch("/logout", {
        method: "POST",
    })
        .then((res) => {
            if (res.ok) {
                formDiv.style.display = "flex";
                radioForm.remove();
                wp2Div.remove();
            } else {
                console.error("error");
            }
        })
        .catch((err) => {
            console.error(err);
        });
}

function checkLoginStatus() {
    fetch("/checkLogin")
        .then((res) => {
            const formDiv = document.getElementsByClassName("formDiv")[0];
            const wp2Div = document.getElementById("wp2");
            if (!res.ok) {
                wp2Div.style.display = "none";
            } else {
                // hide login form, show wp2 div
                wp2Div.style.display = "block";
                formDiv.style.display = "none";
            }
        })
        .catch((err) => {
            console.error(err);
        });
}
