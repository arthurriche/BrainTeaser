export type StripePaymentStatus = "success" | "fail" | "invalid";

export type StripePaymentRequestOptions = {
  country: string;
  currency: string;
  total: { label: string; amount: number };
  requestPayerName?: boolean;
  requestPayerEmail?: boolean;
};

export type StripePaymentRequestPaymentMethodEvent = {
  paymentMethod: { id: string };
  payerName?: string | null;
  payerEmail?: string | null;
  complete: (status: StripePaymentStatus) => void;
};

export type StripeCanMakePaymentResult = {
  applePay?: boolean;
  googlePay?: boolean;
};

export type StripePaymentRequest = {
  canMakePayment: () => Promise<StripeCanMakePaymentResult | null>;
  show: () => Promise<void>;
  update: (details: { total: { label: string; amount: number } }) => void;
  on: (event: "paymentmethod", handler: (event: StripePaymentRequestPaymentMethodEvent) => void) => void;
  off: (event: "paymentmethod", handler: (event: StripePaymentRequestPaymentMethodEvent) => void) => void;
};

export type StripePaymentRequestButtonElement = {
  mount: (dom: HTMLElement | string) => void;
  unmount: () => void;
  destroy: () => void;
};

export type StripeElements = {
  create: (
    type: "paymentRequestButton",
    options: {
      paymentRequest: StripePaymentRequest;
      style?: Record<string, unknown>;
    },
  ) => StripePaymentRequestButtonElement;
};

export type StripeConfirmationResult = {
  error?: { message?: string };
  paymentIntent?: { status?: string };
};

export type Stripe = {
  elements: () => StripeElements;
  paymentRequest: (options: StripePaymentRequestOptions) => StripePaymentRequest;
  confirmCardPayment: (clientSecret: string) => Promise<StripeConfirmationResult>;
};

export type StripeConstructor = (publishableKey: string) => Stripe;

declare global {
  interface Window {
    Stripe?: StripeConstructor;
  }
}

export {};
