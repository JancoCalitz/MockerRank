using System;
using System.Collections.Generic;
using System.IO;
using System.Linq;
using System.Net.Http;
using System.Reflection;
using System.Runtime.InteropServices.JavaScript;
using System.Text.Json;
using System.Threading.Tasks;
using Microsoft.CodeAnalysis;
using Microsoft.CodeAnalysis.CSharp;

public static partial class Runner
{
    static readonly List<MetadataReference> References = new();
    static byte[] compiled;

    public static void Main() { }

    [JSExport]
    public static async Task<int> Init(string baseUrl, string[] names)
    {
        using var http = new HttpClient();
        foreach (var name in names)
        {
            var bytes = await http.GetByteArrayAsync(baseUrl + name + ".dll");
            References.Add(MetadataReference.CreateFromImage(bytes));
        }
        // JIT-warm the compiler so the first real compile is not the slow one.
        Emit("class W { static void Main() { } }");
        return References.Count;
    }

    static IEnumerable<Diagnostic> Emit(string source)
    {
        var tree = CSharpSyntaxTree.ParseText(source);
        var compilation = CSharpCompilation.Create(
            "Submission",
            new[] { tree },
            References,
            new CSharpCompilationOptions(OutputKind.ConsoleApplication, optimizationLevel: OptimizationLevel.Release));
        using var stream = new MemoryStream();
        var result = compilation.Emit(stream);
        compiled = result.Success ? stream.ToArray() : null;
        return result.Diagnostics.Where(d => d.Severity == DiagnosticSeverity.Error);
    }

    [JSExport]
    public static string Compile(string source)
    {
        var errors = Emit(source)
            .Select(d => $"Line {d.Location.GetLineSpan().StartLinePosition.Line + 1}: {d.Id} {d.GetMessage()}")
            .ToArray();
        return JsonSerializer.Serialize(new Dictionary<string, object> { ["ok"] = compiled != null, ["errors"] = errors });
    }

    [JSExport]
    public static string Run(string stdin)
    {
        var output = new StringWriter();
        var errorOutput = new StringWriter();
        Console.SetIn(new StringReader(stdin));
        Console.SetOut(output);
        Console.SetError(errorOutput);
        string exception = null;
        try
        {
            var entry = Assembly.Load(compiled).EntryPoint;
            entry.Invoke(null, entry.GetParameters().Length == 0 ? null : new object[] { Array.Empty<string>() });
        }
        catch (TargetInvocationException e)
        {
            exception = e.InnerException?.ToString();
        }
        return JsonSerializer.Serialize(new Dictionary<string, string>
        {
            ["stdout"] = output.ToString(),
            ["stderr"] = errorOutput.ToString(),
            ["exception"] = exception,
        });
    }
}
