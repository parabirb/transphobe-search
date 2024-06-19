/** @type {import('tailwindcss').Config} */
export default {
    content: ["./src/**/*.{html,svelte}"],
    theme: {
        fontFamily: {
            sans: ["-apple-system", "BlinkMacSystemFont", "Inter", "Helvetica", "sans-serif"],
            mono: ["ui-monospace", "'Fira Code'", "'Roboto Mono'", "Consolas", "monospace"]
        }
    },
    plugins: [],
}

