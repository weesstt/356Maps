window.onload = function() {
    const successMsgElement = document.getElementById("successText");
    const errorMsgElement = document.getElementById("errorText");

    const searchParams = new URLSearchParams(window.location.search);

    for(const [key, value] of searchParams){
        if(key === "error"){
            errorMsgElement.innerHTML = value;
        }else if(key === "success"){
            successMsgElement.innerHTML = value;
        }
    }
}

function registerFormSubmit(event){
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
        password: password
    }

    fetch("/adduser", {
        method: 'POST',
        headers: {
            "Content-Type": "application/json",
            // 'Content-Type': 'application/x-www-form-urlencoded',
          },
        body: JSON.stringify(formData)
    }).then((response) => {
        response.json().then((data) => {
            if (!response.ok) {
                errorMsgElement.innerHTML = data.errorMsg;
            }else{
                successMsgElement.innerHTML = "User successfully registered, please check your email to verify your account."
            }
        });
    }).catch((error) => {
        errorMsgElement.innerHTML = error;
    })
}