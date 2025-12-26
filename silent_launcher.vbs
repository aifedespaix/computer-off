Set WshShell = CreateObject("WScript.Shell")
' Le 0 à la fin signifie : cacher la fenêtre
' On suppose que bun est dans le PATH, sinon remplace bun par le chemin complet
WshShell.Run "bun run server.ts", 0
Set WshShell = Nothing