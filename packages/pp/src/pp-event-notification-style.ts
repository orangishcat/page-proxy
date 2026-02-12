export const buildPageNotificationStyles = (hostId: string, notificationClass: string) => `
#${hostId} {
  position: fixed;
  top: 1rem;
  right: 1rem;
  z-index: 2147483646;
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
  max-width: min(28rem, calc(100vw - 2rem));
  pointer-events: none;
}

.${notificationClass} {
  pointer-events: auto;
  display: flex;
  align-items: flex-start;
  gap: 0.5rem;
  padding: 0.625rem 0.75rem;
  border: 0.0625rem solid #4f5358;
  border-radius: 0.5rem;
  background: rgba(41, 43, 46, 0.96);
  color: #e7e8ea;
  font-family: "JetBrains Mono", "Fira Code", ui-monospace, monospace;
  font-size: 0.75rem;
  line-height: 1.45;
  box-shadow: 0 0.625rem 1.875rem rgba(0, 0, 0, 0.3);
  opacity: 0;
  transform: translateY(-0.375rem);
  transition: opacity 160ms ease, transform 160ms ease;
  word-break: break-word;
}

.${notificationClass}.pp-page-notification--visible {
  opacity: 1;
  transform: translateY(0);
}

.${notificationClass} button {
  border: none;
  background: transparent;
  color: inherit;
  opacity: 0.72;
  padding: 0;
  font-size: 0.875rem;
  line-height: 1;
  cursor: pointer;
}

.${notificationClass} button:hover {
  opacity: 1;
}

.${notificationClass} .pp-page-notification__body {
  display: flex;
  flex-direction: column;
  gap: 0.1875rem;
  min-width: 0;
  max-height: 14rem;
  overflow: auto;
}

.${notificationClass} .pp-page-notification__value {
  min-width: 0;
  white-space: pre-wrap;
}

.${notificationClass} .pp-page-notification__key {
  color: #aeb4bd;
}

.${notificationClass} .pp-page-notification__details {
  margin: 0;
}

.${notificationClass} .pp-page-notification__summary {
  cursor: pointer;
  list-style-position: inside;
}

.${notificationClass} .pp-page-notification__nested {
  margin-left: 0.75rem;
  border-left: 0.0625rem solid rgba(255, 255, 255, 0.16);
  padding-left: 0.5rem;
  padding-top: 0.1875rem;
  display: flex;
  flex-direction: column;
  gap: 0.125rem;
}

.${notificationClass} .pp-page-notification__truncated {
  opacity: 0.78;
}

.${notificationClass} .pp-page-notification__element {
  color: #91c4ff;
  text-decoration: underline;
  text-underline-offset: 0.125rem;
  cursor: pointer;
}

@media (prefers-color-scheme: light) {
  .${notificationClass} {
    background: rgba(246, 247, 248, 0.98);
    border-color: #d2d6da;
    color: #1d232a;
    box-shadow: 0 0.625rem 1.875rem rgba(18, 24, 32, 0.14);
  }
}
`;
