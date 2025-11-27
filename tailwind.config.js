/** @type {import('tailwindcss').Config} */
export default {
    content: [
        "./index.html",
        // ต้องมี ts และ tsx ในนี้ด้วย
        "./src/**/*.{js,ts,jsx,tsx}",
    ],
    theme: {
        extend: {},
    },
    plugins: [],
}