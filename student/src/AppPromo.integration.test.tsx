import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("./lib/supabase", () => ({
  supabase: {},
}));

function setUserAgent(userAgent: string) {
  Object.defineProperty(window.navigator, "userAgent", {
    value: userAgent,
    configurable: true,
  });
}

describe("MobileAppPromoProvider (integração)", () => {
  beforeEach(() => {
    localStorage.clear();
    vi.restoreAllMocks();
  });

  it("exibe modal em Android e abre o link ao clicar", async () => {
    const {
      ANDROID_PROMO_DISMISSED_KEY,
      ANDROID_TESTERS_URL,
      MobileAppPromoProvider,
    } = await import("./App");
    setUserAgent(
      "Mozilla/5.0 (Linux; Android 14; Pixel 7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Mobile Safari/537.36",
    );

    const openSpy = vi
      .spyOn(window, "open")
      .mockImplementation(() => null as any);
    const user = userEvent.setup();

    render(
      <MobileAppPromoProvider>
        <div>conteúdo</div>
      </MobileAppPromoProvider>,
    );

    expect(
      await screen.findByRole("heading", {
        name: /versão mobile disponível para teste/i,
      }),
    ).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: /ver como testar/i }));

    expect(openSpy).toHaveBeenCalledWith(
      ANDROID_TESTERS_URL,
      "_blank",
      "noopener,noreferrer",
    );
    expect(localStorage.getItem(ANDROID_PROMO_DISMISSED_KEY)).toBe("1");
  });

  it("não exibe modal quando o dismiss já foi persistido", async () => {
    const { ANDROID_PROMO_DISMISSED_KEY, MobileAppPromoProvider } =
      await import("./App");
    setUserAgent(
      "Mozilla/5.0 (Linux; Android 14; Pixel 7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Mobile Safari/537.36",
    );
    localStorage.setItem(ANDROID_PROMO_DISMISSED_KEY, "1");

    render(
      <MobileAppPromoProvider>
        <div>conteúdo</div>
      </MobileAppPromoProvider>,
    );

    expect(
      screen.queryByRole("heading", {
        name: /versão mobile disponível para teste/i,
      }),
    ).toBeNull();
  });

  it("não exibe modal fora do Android", async () => {
    const { MobileAppPromoProvider } = await import("./App");
    setUserAgent(
      "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1",
    );

    render(
      <MobileAppPromoProvider>
        <div>conteúdo</div>
      </MobileAppPromoProvider>,
    );

    expect(
      screen.queryByRole("heading", {
        name: /versão mobile disponível para teste/i,
      }),
    ).toBeNull();
  });
});
