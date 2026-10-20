import "./styles/app.css";
import { init, registerAppUpdatePrompt } from "./app/runtime.js";

document.addEventListener("DOMContentLoaded", init);
registerAppUpdatePrompt();
