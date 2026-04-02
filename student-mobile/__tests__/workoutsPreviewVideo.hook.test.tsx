import { renderHook, waitFor } from "@testing-library/react-native";
import { useMp4PreviewVideo } from "../lib/workoutsPreviewVideo";

describe("useMp4PreviewVideo", () => {
  it("carrega MP4 apenas quando a URL muda (ignora re-renders)", async () => {
    const player = {
      replaceAsync: jest.fn(async () => {}),
      play: jest.fn(),
      pause: jest.fn(),
    };
    const setLoading = jest.fn();

    const { rerender } = renderHook(
      ({ mp4Url, tick }: { mp4Url: string | null; tick: number }) => {
        useMp4PreviewVideo({ player, mp4Url, setLoading });
        return tick;
      },
      { initialProps: { mp4Url: "https://cdn.example.com/a.mp4", tick: 0 } },
    );

    await waitFor(() => {
      expect(player.replaceAsync).toHaveBeenCalledTimes(1);
      expect(player.replaceAsync).toHaveBeenCalledWith({
        uri: "https://cdn.example.com/a.mp4",
      });
      expect(player.play).toHaveBeenCalledTimes(1);
    });

    rerender({ mp4Url: "https://cdn.example.com/a.mp4", tick: 1 });

    await waitFor(() => {
      expect(player.replaceAsync).toHaveBeenCalledTimes(1);
    });

    rerender({ mp4Url: "https://cdn.example.com/b.mp4", tick: 2 });

    await waitFor(() => {
      expect(player.replaceAsync).toHaveBeenCalledTimes(2);
      expect(player.replaceAsync).toHaveBeenLastCalledWith({
        uri: "https://cdn.example.com/b.mp4",
      });
    });

    rerender({ mp4Url: null, tick: 3 });

    await waitFor(() => {
      expect(player.pause).toHaveBeenCalled();
      expect(player.replaceAsync).toHaveBeenCalledWith(null);
    });
  });
});

