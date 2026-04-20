# Web Frontend

## Build WASM package

```powershell
wasm-pack build --target web --out-dir web/pkg
```

## Serve locally

```powershell
python -m http.server 8080
```

Open <http://localhost:8080/web/>.
