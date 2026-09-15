import "./globals.css";

export const metadata = {
  title: "Выкуп товаров и оплата в Китай — ИП Магомедгаджиев",
  description:
    "Выкупаю товары и оплачиваю поставщиков в Китае: 1688, Taobao, Poizon, Pinduoduo. Оплата напрямую на счёт поставщика, доставка по РФ. От 1¥.",
  robots: "index, follow",
  openGraph: {
    type: "website",
    title: "Выкуп товаров и оплата в Китай",
    description:
      "Выкуп товаров с 1688, Taobao, Poizon и оплата поставщиков в Китае. Доставка по России. От 1¥.",
    locale: "ru_RU",
  },
};

export const viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#0a1f2b",
};

export default function RootLayout({ children }) {
  return (
    <html lang="ru">
      <body>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          href="https://fonts.googleapis.com/css2?family=Jost:wght@300;400;500;600;700&display=swap&subset=cyrillic,latin"
          rel="stylesheet"
        />
        {children}
      </body>
    </html>
  );
}
