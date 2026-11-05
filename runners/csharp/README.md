# C# runner

The browser needs the C# compiler (Roslyn) and the full .NET library, which no ready-made package
provides. This project builds them into static files in `publish/`, which are committed so that
nobody using MockerRank needs the .NET SDK.

Rebuild only when `Program.cs` or the target framework changes, using the
[.NET 10 SDK](https://dotnet.microsoft.com/download/dotnet/10.0):

```sh
dotnet publish -c Release -o build-output
```

Then replace `publish/_framework` with `build-output/wwwroot/_framework`, delete `build-output`, and
run `npm install` to copy the result into the app. Keep `publish/worker.js`, which is hand-written.
