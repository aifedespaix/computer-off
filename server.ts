import { serve } from "bun";
import { networkInterfaces } from "os";
import { spawn } from "child_process"; // Using node:child_process for Windows command compatibility/easier concat

// --- CONFIGURATION ---
const PORT = 3001;
// Note: Modifier ces commandes selon votre configuration exacte
const CMD_GOXLR = "goxlr-client load-profile Sleep";
const CMD_SHUTDOWN = "shutdown /s /t 0";

// --- UTILS ---
function getLocalIp() {
  const nets = networkInterfaces();
  const results = Object.create(null); // Or just use an array

  for (const name of Object.keys(nets)) {
    for (const net of nets[name]!) {
      // Skip over non-IPv4 and internal (i.e. 127.0.0.1) addresses
      if (net.family === "IPv4" && !net.internal) {
        if (!results[name]) {
          results[name] = [];
        }
        results[name].push(net.address);
      }
    }
  }

  // Return the first found non-internal IPv4
  const allIps = Object.values(results).flat();
  return allIps.length > 0 ? allIps[0] : "localhost";
}

// --- SERVER ---
console.log(`\n🚀 Serveur de Contrôle PC démarré !`);
console.log(`📱 Accédez à l'app via : http://${getLocalIp()}:${PORT}`);
console.log(`🔒 Appuyez sur Ctrl+C pour arrêter le serveur.\n`);

serve({
  port: PORT,
  async fetch(req) {
    const url = new URL(req.url);

    // 1. API Endpoint: Shutdown
    if (url.pathname === "/shutdown" && req.method === "POST") {
      console.log(
        `[${new Date().toLocaleTimeString()}] ⚠️  Demande d'arrêt reçue...`
      );

      try {
        // Étape 1 : GoXLR
        // console.log(`> Exécution : ${CMD_GOXLR}`);
        // Note: Sur Windows, il est souvent préférable d'utiliser 'shell: true' ou d'invoquer via cmd /c
        // Pour Bun natif, on peut utiliser Bun.spawn, mais child_process est parfois plus stable pour les commandes Windows legacy.
        // On va tenter une approche séquentielle simple avec spawn.

        // Mock execution check for testing environment (if needed), but here we write for Prod.
        // We wrap in a promise to await execution
        // await runCommand(CMD_GOXLR);

        // Étape 2 : Shutdown
        console.log(`> Exécution : ${CMD_SHUTDOWN}`);
        // Dans un vrai scénario, on décommente la ligne suivante.
        // Pour la sécurité du développement, je la laisse active mais soyez conscient.
        await runCommand(CMD_SHUTDOWN);

        return new Response(
          JSON.stringify({
            status: "success",
            message: "PC en cours d'extinction",
          }),
          {
            headers: { "Content-Type": "application/json" },
          }
        );
      } catch (error) {
        console.error("❌ Erreur lors de l'exécution des commandes:", error);
        return new Response(
          JSON.stringify({ status: "error", message: String(error) }),
          {
            status: 500,
            headers: { "Content-Type": "application/json" },
          }
        );
      }
    }

    // 2. Static File Serving
    let filePath = url.pathname;
    if (filePath === "/") filePath = "/index.html";

    // Security check: Prevent directory traversal
    const safePath = filePath.replace(/^(\.\.[\/\\])+/, "");
    const src = "public" + safePath;

    // Additional check to ensure we stay in public/ (though Bun.file handles basic path resolution,
    // it's good practice to ensure we don't serve outside intended scope if logic changes)
    if (safePath.includes("..")) {
      return new Response("Forbidden", { status: 403 });
    }

    const file = Bun.file(src);

    if (await file.exists()) {
      return new Response(file);
    }

    // 404
    return new Response("Not Found", { status: 404 });
  },
});

// Helper function to run shell commands
function runCommand(command: string): Promise<void> {
  return new Promise((resolve, reject) => {
    // Split command for spawn logic if not using shell: true
    // However, specifically for Windows commands like 'shutdown /s /t 0',
    // it's often easiest to run inside a shell.

    // Using Bun.spawn is preferred in Bun, but let's stick to node:child_process
    // for maximum compatibility with Windows shell commands string parsing.

    const process = spawn(command, { shell: true, stdio: "inherit" });

    process.on("close", (code) => {
      if (code === 0) {
        resolve();
      } else {
        // On ne reject pas forcément pour le GoXLR si la commande échoue (ex: pas installé),
        // on veut peut-être quand même éteindre le PC ?
        // Pour l'instant on log l'erreur mais on resolve pour continuer (soft fail).
        console.warn(
          `⚠️  La commande "${command}" a terminé avec le code ${code}. Continuation...`
        );
        resolve();
      }
    });

    process.on("error", (err) => {
      console.error(`❌ Erreur fatale commande "${command}":`, err);
      // Soft fail aussi pour garantir que le shutdown se tente quand même ?
      // Si GoXLR échoue, on veut surement quand même éteindre le PC.
      resolve();
    });
  });
}
