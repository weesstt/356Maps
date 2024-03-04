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

    fetch("194.113.74.197/adduser", {
        method: 'POST',
        headers: {
            "Content-Type": "application/json",
            // 'Content-Type': 'application/x-www-form-urlencoded',
          },
        body: JSON.stringify(data)
    }).then(() => {
        successMsgElement.innerHTML = "User registered, please check your email to verify your account."
    }).catch((error) => {
        errorMsgElement.innerHTML = error;
    })
}