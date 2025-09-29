/* /js/page-transitions.js */
/* ทำ navigation ให้ลื่น: ใช้ View Transitions (ถ้ามี) + fallback fade */
(function () {
    const supportsVT = typeof document.startViewTransition === "function";
    const prefersNoMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    // ใส่คลาสสำหรับ fallback fade ตอนโหลดหน้าแรก
    document.addEventListener("DOMContentLoaded", () => {
        document.body.classList.add("body-fade");
        // เผื่อบางเบราว์เซอร์ flash ตอนเริ่ม
        requestAnimationFrame(() => {
            document.body.classList.remove("is-exiting");
        });
    });

    // ช่วยเช็คว่าเป็นลิงก์ภายใน ไม่นำไป external / new tab / hash-only
    function isInternalNav(a) {
        if (!a || a.target === "_blank" || a.download) return false;
        const url = new URL(a.href, location.href);
        if (url.origin !== location.origin) return false;
        // ลิงก์ hash ภายในหน้า ปล่อยให้ browser จัดการ (เราก็มี scroll-behavior: smooth อยู่แล้ว)
        if (url.pathname === location.pathname && url.hash) return false;
        // mailto/tel
        if (url.protocol === "mailto:" || url.protocol === "tel:") return false;
        return true;
    }

    // จัดการคลิกทุกลิงก์ในหน้า (รวม navbar/sidebar)
    document.addEventListener("click", (e) => {
        const a = e.target.closest("a");
        if (!a || !isInternalNav(a)) return;

        if (prefersNoMotion) return; // เคารพ reduced motion -> ปล่อย native

        e.preventDefault();

        const go = () => { location.href = a.href; };

        // ใช้ View Transitions ถ้ารองรับ
        if (supportsVT) {
            // ให้เอฟเฟกต์เริ่มทันที (ไม่ดีเลย์)
            document.startViewTransition(() => go());
            return;
        }

        // Fallback: ค่อยๆ จางหายแล้วค่อยไปหน้าใหม่
        document.body.classList.add("is-exiting");
        setTimeout(go, 200); // ให้พอทันเล่น transition
    }, { capture: true });
})();
