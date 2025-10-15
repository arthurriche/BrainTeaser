interface StripePaymentRequestOptions {
  country: string;
  currency: string;
  total: { label: string; amount: number };
  requestPayerName?: boolean;
  requestPayerEmail?: boolean;
}

type StripePaymentStatus = "success" | "fail" | "invalid";

interface StripePaymentRequestPaymentMethodEvent {
  paymentMethod: { id: string };
  payerName?: string | null;
  payerEmail?: string | null;
  complete(status: StripePaymentStatus): void;
}

interface StripeCanMakePaymentResult {
  applePay?: boolean;
  googlePay?: boolean;
}

interface StripePaymentRequest {
  canMakePayment(): Promise<StripeCanMakePaymentResult | null>;
  show(): Promise<void>;
  update(details: { total: { label: string; amount: number } }): void;
  on(event: "paymentmethod", handler: (event: StripePaymentRequestPaymentMethodEvent) => void): void;
  off(event: "paymentmethod", handler: (event: StripePaymentRequestPaymentMethodEvent) => void): void;
}

interface StripePaymentRequestButtonElement {
  mount(dom: HTMLElement | string): void;
  unmount(): void;
  destroy(): void;
}

interface StripeElements {
  create(
    type: "paymentRequestButton",
    options: {
      paymentRequest: StripePaymentRequest;
      style?: Record<string, unknown>;
    },
  ): StripePaymentRequestButtonElement;
}

interface StripeConfirmationResult {
  error?: { message?: string };
  paymentIntent?: { status?: string };
}

interface Stripe {
  elements(): StripeElements;
  paymentRequest(options: StripePaymentRequestOptions): StripePaymentRequest;
  confirmCardPayment(clientSecret: string): Promise<StripeConfirmationResult>;
}

type StripeConstructor = (publishableKey: string) => Stripe;

declare global {
  interface Window {
    Stripe?: StripeConstructor;
  }
}

export {};
