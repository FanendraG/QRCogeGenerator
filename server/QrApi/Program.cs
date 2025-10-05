using Microsoft.AspNetCore.Mvc;
using QRCoder;

internal class Program
{
    private static void Main(string[] args)
    {
        var builder = WebApplication.CreateBuilder(args);


        const string DevClient = "http://localhost:5173"; // Vite default

        builder.Services.AddCors(o => o.AddDefaultPolicy(p =>
        p.WithOrigins(DevClient)
        .AllowAnyHeader()
        .AllowAnyMethod()
        ));


        builder.Services.AddEndpointsApiExplorer();
        builder.Services.AddSwaggerGen();


        var app = builder.Build();


        app.UseCors();


        if (app.Environment.IsDevelopment())
        {
            app.UseSwagger();
            app.UseSwaggerUI();
        }


        app.MapPost("/api/qr", ([FromBody] GenerateQrRequest req) =>
        {
            if (string.IsNullOrWhiteSpace(req.text))
                return Results.BadRequest(new { error = "'text' is required" });


            var format = (req.format ?? "png").ToLowerInvariant();
            var ppm = req.pixelsPerModule is > 0 and <= 50 ? req.pixelsPerModule.Value : 10;


            // Generate QR data
            var generator = new QRCodeGenerator();
            var data = generator.CreateQrCode(req.text, QRCodeGenerator.ECCLevel.M);


            if (format == "svg")
            {
                var svg = new SvgQRCode(data).GetGraphic(ppm);
                var svgEscaped = Uri.EscapeDataString(svg);
                var dataUrl = $"data:image/svg+xml;utf8,{svgEscaped}";
                return Results.Ok(new GenerateQrResponse(dataUrl, "image/svg+xml", ppm, "svg"));
            }
            else
            {
                var pngBytes = new PngByteQRCode(data).GetGraphic(ppm);
                var base64 = Convert.ToBase64String(pngBytes);
                var dataUrl = $"data:image/png;base64,{base64}";
                return Results.Ok(new GenerateQrResponse(dataUrl, "image/png", ppm, "png"));
            }
        })
        .WithName("GenerateQr")
        .Produces<GenerateQrResponse>(StatusCodes.Status200OK)
        .Produces(StatusCodes.Status400BadRequest);


        app.Run();
    }
}


// Request DTO
public record GenerateQrRequest(
string text,
string? format = "png", // "png" | "svg"
int? pixelsPerModule = 10 // size scalar for both png & svg
);


// Response DTO
public record GenerateQrResponse(
string dataUrl,
string contentType,
int pixelsPerModule,
string format
);
