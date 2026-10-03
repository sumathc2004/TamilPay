using TamilPay.Api.Services;

var builder = WebApplication.CreateBuilder(args);

builder.Services.AddControllers();
builder.Services.AddMemoryCache();
builder.Services.AddOpenApi();

builder.Services.AddHttpClient("RemoteApi", client =>
{
    client.BaseAddress = new Uri(builder.Configuration["RemoteApi:BaseUrl"]!);
    client.Timeout = TimeSpan.FromSeconds(20);
});
builder.Services.AddScoped<RemoteApiClient>();

// The BBPS service is separate from the clients API; its full URL comes from Bbps:BillersUrl.
builder.Services.AddHttpClient("Bbps", client => client.Timeout = TimeSpan.FromSeconds(30));

const string FrontendCorsPolicy = "FrontendCorsPolicy";
builder.Services.AddCors(options =>
{
    options.AddPolicy(FrontendCorsPolicy, policy =>
    {
        policy.AllowAnyOrigin()
              .AllowAnyHeader()
              .AllowAnyMethod();
    });
});

var app = builder.Build();

if (app.Environment.IsDevelopment())
{
    app.MapOpenApi();
}

app.UseHttpsRedirection();

// Serves the frontend's built files (index.html, assets/) from wwwroot alongside the API,
// since this app and the frontend are deployed together as one IIS site.
app.UseDefaultFiles();
app.UseStaticFiles();

// Without this, WebApplication auto-inserts routing at the very start of the
// pipeline (before UseStaticFiles), so the catch-all SPA fallback route below
// matches every request during routing before static files even runs — and
// UseStaticFiles then sees an endpoint was already selected and skips serving
// the real file, silently falling through to index.html for every asset.
// Explicitly placing UseRouting here (after static files, before the fallback
// route) fixes that ordering.
app.UseRouting();

app.UseCors(FrontendCorsPolicy);

app.UseAuthorization();

app.MapControllers();

// The frontend now has its own client-side routes (/pg, /reports, /customers/5, ...)
// via the browser History API, not just in-memory state — so a direct hit or a
// refresh on one of those paths is a real GET request that reaches the server, not
// something the SPA can intercept. Nothing on disk matches that path, so without
// this it 404s instead of loading the app, which then reads the path itself and
// renders the right page client-side.
//
// The route pattern explicitly excludes "api" — a bare MapFallbackToFile("index.html")
// catches every unmatched request, including a genuinely wrong/typo'd /api/* URL,
// silently turning what should be a 404 into a 200 that serves the SPA shell instead
// (confirmed this the hard way: /api/does-not-exist came back 200 before this fix).
app.MapFallbackToFile("{*path:regex(^(?!api).*$)}", "index.html");

app.Run();
