using System;
using System.Collections.Generic;
using System.IO;
using System.Linq;
using System.Net.Http;
using System.Reflection;
using System.Runtime.InteropServices.JavaScript;
using System.Text;
using System.Text.Json;
using System.Threading.Tasks;
using Microsoft.CodeAnalysis;
using Microsoft.CodeAnalysis.CSharp;

// Compiles and runs C# in the browser. See README.md for how to rebuild it.
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
        return References.Count;
    }

    [JSExport]
    public static string Compile(string source)
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
        var errors = result.Diagnostics
            .Where(d => d.Severity == DiagnosticSeverity.Error)
            .Select(d => $"Line {d.Location.GetLineSpan().StartLinePosition.Line + 1}: {d.Id}: {d.GetMessage()}");
        return string.Join("\n", errors);
    }

    sealed class LimitedWriter : StringWriter
    {
        readonly int limit;

        public LimitedWriter(int limit) { this.limit = limit; }

        void Check(int more)
        {
            if (GetStringBuilder().Length + more > limit) throw new OutputLimitException();
        }

        public override void Write(char value) { Check(1); base.Write(value); }
        public override void Write(char[] buffer, int index, int count) { Check(count); base.Write(buffer, index, count); }
        public override void Write(string value) { Check(value?.Length ?? 0); base.Write(value); }
    }

    sealed class OutputLimitException : Exception
    {
        public OutputLimitException() : base("Output limit exceeded") { }
    }

    [JSExport]
    public static string Run(string stdin, int outputLimit)
    {
        var output = new LimitedWriter(outputLimit);
        var errors = new LimitedWriter(outputLimit);
        Console.SetIn(new StringReader(stdin));
        Console.SetOut(output);
        Console.SetError(errors);
        var status = "ok";
        try
        {
            // Loading a fresh copy gives each test run its own static variables.
            var entry = Assembly.Load(compiled).EntryPoint;
            var result = entry.Invoke(null, entry.GetParameters().Length == 0 ? null : new object[] { Array.Empty<string>() });
            if (result is Task task) task.GetAwaiter().GetResult();
        }
        catch (TargetInvocationException e) when (e.InnerException is OutOfMemoryException)
        {
            status = "memory-limit";
        }
        catch (OutOfMemoryException)
        {
            status = "memory-limit";
        }
        catch (TargetInvocationException e)
        {
            status = "runtime-error";
            errors.GetStringBuilder().Append(e.InnerException);
        }
        return JsonSerializer.Serialize(new Dictionary<string, string>
        {
            ["stdout"] = output.ToString(),
            ["stderr"] = errors.ToString(),
            ["status"] = status,
        });
    }
}
