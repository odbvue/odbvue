# Analytics

Adding Google analytics to the project.

## Setting account in Google Analytics

1. **Create a Google Analytics Account**:

   - Visit the [Google Analytics website](https://analytics.google.com/).
   - Sign in with your Google account or create one if you don't have it.
   - Click on "Admin" and then "Create Account." Follow the instructions to set up a new account.

2. **Set Up a Property in Your Account**:

   - In Google Analytics, a "Property" represents your website or app.
   - Click on "Create Property" after setting up your account.
   - Enter the name of your website or app, and select the reporting time zone and currency.
   - Click "Next" to proceed and provide information about your business.

3. **Create a GA4 Property**:

   - GA4 is the latest version of Google Analytics.
   - In the property setup, select “GA4” as the property type.
   - Follow the prompts to complete the GA4 property setup.

4. **Set Up a Data Stream**:
   - A data stream is where your data will come from (your web application in this case).
   - In your GA4 property, click on "Data Streams" and then "Add Stream."
   - Select "Web" as the stream type.
   - Enter your website URL and stream name.
   - You will receive a "Measurement ID" or a "Global Site Tag (gtag.js)" which you'll need to add to your website.

## Install the tracker

1. For static sites & web applications

```html
<head>
  ...
  <!-- Global site tag (gtag.js) - Google Analytics -->
  <script async src="https://www.googletagmanager.com/gtag/js?id=G-XXXXXXXX"></script>
  <script>
    window.dataLayer = window.dataLayer || []
    function gtag() {
      dataLayer.push(arguments)
    }
    gtag('js', new Date())
    gtag('config', 'G-XXXXXXXX')
  </script>
  <!-- end - Google Analytics -->
  ...
</head>
```

2. For VitePress

#### `./apps/wiki/.vitepress/config.ts`

```ts
...
  head: [
    [
      "script",
      {
        async: "",
        src: "https://www.googletagmanager.com/gtag/js?id=G-XXXXXXXX",
      },
    ],
    ["script", {}, "window.dataLayer = window.dataLayer || [];\nfunction gtag(){dataLayer.push(arguments);}\ngtag('js', new Date());\ngtag('config', 'G-XXXXXXXX');"],
  ],
...

```
