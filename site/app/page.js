import fs from "node:fs";
import path from "node:path";
import Script from "next/script";

export default function Page() {
  const markup = fs.readFileSync(path.join(process.cwd(), "lib", "legacy-markup.html"), "utf8");
  const legacyScript = fs.readFileSync(path.join(process.cwd(), "lib", "legacy-script.js"), "utf8");

  return (
    <>
      <div dangerouslySetInnerHTML={{ __html: markup }} />
      <Script id="legacy-site-script" strategy="afterInteractive">
        {legacyScript}
      </Script>
    </>
  );
}
