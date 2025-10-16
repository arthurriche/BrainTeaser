declare module "@stripe/stripe-js" {
  export type StripePaymentRequestPaymentMethodEvent = {
    paymentMethod: { id: string };
    complete: (status: "success" | "fail") => void;
  };

  export type StripePaymentRequest = {
    canMakePayment: () => Promise<{ applePay?: boolean } | null>;
    update: (details: { total: { label: string; amount: number } }) => void;
    on: (event: "paymentmethod", handler: (event: StripePaymentRequestPaymentMethodEvent) => void) => void;
    off: (event: "paymentmethod", handler: (event: StripePaymentRequestPaymentMethodEvent) => void) => void;
  };

  export type StripeElements = {
    create: (
      type: "paymentRequestButton",
      options: {
        paymentRequest: StripePaymentRequest;
        style?: {
          paymentRequestButton?: {
            type?: string;
            theme?: string;
            height?: string;
          };
        };
      },
    ) => { mount: (element: Element | string) => void; unmount: () => void };
  };

  export type Stripe = {
    paymentRequest: (options: {
      country: string;
      currency: string;
      total: { label: string; amount: number };
      requestPayerEmail?: boolean;
      requestPayerName?: boolean;
    }) => StripePaymentRequest;
    confirmCardPayment: (clientSecret: string) => Promise<{ error?: { message?: string } }>;
    elements: () => StripeElements;
  };
}

declare global {
  interface Window {
    Stripe?: (publishableKey: string) => import("@stripe/stripe-js").Stripe;
  }
}

export {};
