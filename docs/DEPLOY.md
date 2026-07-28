# Deploy v0.4

The Neon connection is already proven if `/api/load` returned `No cloud save was found.`

## Update the existing repository

Copy the v0.4 files into the repository folder, then run:

```powershell
git add .
git commit -m "Expand the complete football universe"
git push
```

Vercel installs the dependencies from `package.json` and deploys automatically.

## First cloud save

1. Open the deployed game.
2. Create the new v0.4 universe.
3. Press **Save** in the top bar.
4. Keep the generated private cloud code.
5. On another device, enter that code through **Cloud code**, then press **Load cloud**.

No `.env.local`, Vercel CLI or local API testing is required for this workflow.

v0.3 saves are not loaded because the simulation structure changed substantially.
