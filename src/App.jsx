import React from "react";
import { Route, Routes } from "react-router-dom";
import { datadogRum } from '@datadog/browser-rum';
import { datadogLogs } from '@datadog/browser-logs';
import datadogRumInterceptor from '@kyletaylored/datadog-rum-interceptor';

//Import Components
import About from "./components/About";
import { EnvProvider } from "./components/Context";
import Error from "./components/Error";
import Home from "./components/Home";
import Navigation from "./components/Navigation";
import Form from "./components/Form";
import RumViewTracker from "./components/RumViewTracker";
import KafkaDemo from "./components/KafkaDemo";

const applicationId = import.meta.env.VITE_DATADOG_APPLICATION_ID;
const clientToken = import.meta.env.VITE_DATADOG_CLIENT_TOKEN;
const site = import.meta.env.VITE_DATADOG_SITE;
const service = import.meta.env.VITE_DATADOG_SERVICE;
const env = import.meta.env.VITE_ENVIRONMENT;
const release = import.meta.env.VITE_RELEASE;

// Define which paths should start a new RUM view
const RUM_VIEW_PATHS = ['/', '/about', '/error', '/kafka'];

// Initialize the interceptor correctly
const DRI = datadogRumInterceptor.init({ debug: true });

datadogRum.init({
  applicationId: applicationId,
  clientToken: clientToken,
  site: site,
  service: service,
  env: env,
  version: release,
  sessionSampleRate: 100,
  sessionReplaySampleRate: 100,
  trackViewsManually: true,
  trackUserInteractions: true,
  trackResources: true,
  trackLongTasks: true,
  defaultPrivacyLevel: 'allow',
  forwardErrorsToLogs: true,
  allowedTracingUrls: [
    "https://api-images.quickstark.com",
    (url) => url.startsWith("http://localhost")
  ],
  beforeSend: (event, context) => {
    console.log('Datadog RUM Event:', event.type, event);
    if (event.type === 'resource' && ['xhr', 'fetch'].includes(event.resource.type)) {
      const payload = DRI.getPayload({ event, context });
      if (payload) {
        event.context.payload = payload;
      }
    }
    return true;
  },
});

// Initialize Datadog logs
datadogLogs.init({
  clientToken: clientToken,
  site: site,
  service: service,
  env: env,
  version: release,
  forwardErrorsToLogs: true,
  sessionSampleRate: 100
});

// Add a custom action to verify RUM is collecting data
datadogRum.addAction('test_action', { test: 'data' });

// Add global context with image information for testing
datadogRum.setGlobalContextProperty('imageContext', {
  source: 'quickstark-vite-images',
  formats: ['jpg', 'png', 'webp'],
  processingEnabled: true,
  maxUploadSize: 5242880, // 5MB in bytes
  compressionLevel: 'medium',
  cdnEnabled: true
});

// Add another contextual information about user preferences
datadogRum.setGlobalContextProperty('userImagePreferences', {
  defaultFormat: 'webp',
  autoOptimize: true,
  preferredDimensions: {
    width: 1200,
    height: 800
  }
});

// Add a test log to verify logs are working
datadogLogs.logger.info('Application initialized', { feature: 'initialization' });

// Log that we've set custom context
datadogLogs.logger.info('Custom image context added to RUM', {
  feature: 'rum-context',
  contextType: 'imageContext'
});

function App() {
  return (
    <>
      <EnvProvider>
        <Navigation />
        <RumViewTracker allowedViewPaths={RUM_VIEW_PATHS} />
        <Routes>
          <Route path="/" element={<Home />}></Route>
          <Route path="/about" element={<About />}></Route>
          <Route path="/error" element={<Error />}></Route>
          <Route path="/form" element={<Form />}></Route>
          <Route path="/kafka" element={<KafkaDemo />}></Route>
        </Routes>
      </EnvProvider>
    </>
  );
}

export default App;
