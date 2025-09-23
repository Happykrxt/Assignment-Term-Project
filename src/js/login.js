document.addEventListener("DOMContentLoaded", () => {
    const form = document.getElementById("loginForm");
    const email = document.getElementById("email");
    const pass = document.getElementById("password");
    const emailErr = document.querySelector('[data-error-for="email"]');
    const passErr = document.querySelector('[data-error-for="password"]');

    const toggle = document.querySelector(".toggle-pass");
    if (toggle && pass) {
        toggle.addEventListener("click", () => {
            const type = pass.getAttribute("type") === "password" ? "text" : "password";
            pass.setAttribute("type", type);
        });
    }

    form?.addEventListener("submit", (e) => {
        e.preventDefault();
        let ok = true;
        emailErr.textContent = "";
        passErr.textContent = "";

        if (!email.value.includes("@")) {
            emailErr.textContent = "กรุณากรอกอีเมลให้ถูกต้อง";
            ok = false;
        }

        if (!pass.value || pass.value.length < 6) {
            passErr.textContent = "รหัสผ่านอย่างน้อย 6 ตัวอักษร";
            ok = false;
        }

        if (ok) {
            console.log("Submit", {
                email: email.value,
            });
            alert("Signed in (Demo)");
        }
    });

    // Mouse FX
    const card = document.querySelector(".card");
    const panel = document.querySelector(".brand-panel");

    document.addEventListener("mousemove", (e) => {
        const x = e.clientX / window.innerWidth - 0.5;
        const y = e.clientY / window.innerHeight - 0.5;

        // CSS variables for background
        document.documentElement.style.setProperty("--mouse-x", `${e.clientX}px`);
        document.documentElement.style.setProperty("--mouse-y", `${e.clientY}px`);

        // Card tilt effect
        const rotateX = y * 10;
        const rotateY = x * 10;
        card.style.transform = `rotateX(${-rotateX}deg) rotateY(${rotateY}deg)`;
        panel.style.transform = `rotateX(${-rotateX}deg) rotateY(${rotateY}deg)`;
    });
});
