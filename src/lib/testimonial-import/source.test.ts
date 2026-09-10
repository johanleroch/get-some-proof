import { withTestimonialIds } from "../../../tests/testimonial-source-fixture";
// @vitest-environment node
import { afterEach, describe, expect, it, vi } from "vitest";

import { previewWall, readWallSource } from "./source";

describe("public testimonial wall retrieval", () => {
  afterEach(() => vi.unstubAllGlobals());

  it.each([
    "http://testimonial.to/atelier/all",
    "https://testimonial.to.evil.example/atelier/all",
    "https://user:password@testimonial.to/atelier/all",
    "https://127.0.0.1/wall",
    "https://testimonial.to:8443/atelier/all",
    "https://testimonial.to/dashboard",
    "https://senja.io.evil.example/p/atelier/testimonials",
    "https://senja.io/p/atelier/r/form-id",
    "https://senja.io/p/atelier/t/testimonial-id",
  ])(
    "refuses unsupported sources before sending a request: %s",
    async (url) => {
      const request = vi.fn();
      vi.stubGlobal("fetch", request);
      await expect(readWallSource(url)).rejects.toMatchObject({
        code: "UNSUPPORTED_WALL_URL",
      });
      expect(request).not.toHaveBeenCalled();
    },
  );

  it("reads the public wall without forwarding tracking parameters", async () => {
    const request = vi.fn().mockResolvedValue(
      new Response("<main>A public wall</main>", {
        headers: { "content-type": "text/html; charset=utf-8" },
      }),
    );
    vi.stubGlobal("fetch", request);
    await expect(
      readWallSource(
        "https://testimonial.to/atelier/all/?token=private#section",
      ),
    ).resolves.toEqual({
      provider: "testimonial-to",
      url: "https://testimonial.to/atelier/all",
      html: "<main>A public wall</main>",
    });
    expect(request).toHaveBeenCalledWith(
      "https://testimonial.to/atelier/all",
      expect.objectContaining({ redirect: "error" }),
    );
  });

  it("refuses an oversized source even without a content-length header", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        new Response("x".repeat(4_000_001), {
          headers: { "content-type": "text/html" },
        }),
      ),
    );
    await expect(
      readWallSource("https://testimonial.to/atelier/all"),
    ).rejects.toMatchObject({ code: "WALL_TOO_LARGE" });
  });

  it("previews the exact visible quotation and author without executing source scripts", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        new Response(
          withTestimonialIds(`<main>
          <div class="testimonial-card text-testimonial">
            <div><span class="font-bold">Lucie Bernard</span><p class="text-sm">Fondatrice, Atelier Rose</p></div>
            <div class="show-more-text"><div><b>Un vrai gain de temps.</b><br>Merci &amp; bravo !</div></div>
          </div>
          <script>throw new Error("must not execute");</script>
        </main>`),
          { headers: { "content-type": "text/html" } },
        ),
      ),
    );
    const preview = await previewWall("https://testimonial.to/atelier/all");
    expect(preview.items).toEqual([
      expect.objectContaining({
        type: "text",
        authorName: "Lucie Bernard",
        tagline: "Fondatrice, Atelier Rose",
        text: "Un vrai gain de temps.\nMerci & bravo !",
        sourceId: "proof-0",
      }),
    ]);
  });

  it("keeps provider identities when text changes and cards are reordered", async () => {
    const card = (name: string, text: string) =>
      `<article class="testimonial-card text-testimonial"><span class="font-bold">${name}</span><div class="show-more-text">${text}</div></article>`;
    let html = withTestimonialIds(
      card("Lina", "Original words") + card("Camille", "Second quote"),
      ["lina-proof", "camille-proof"],
    );
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => new Response(html)),
    );
    const before = await previewWall("https://testimonial.to/atelier/all");
    html = withTestimonialIds(
      card("Camille Moreau", "Edited words") + card("Lina", "Original words"),
      ["camille-proof", "lina-proof"],
    );
    const after = await previewWall("https://testimonial.to/atelier/all");
    expect(after.items.map((item) => item.sourceId)).toEqual([
      before.items[1].sourceId,
      before.items[0].sourceId,
    ]);
    expect(after.items[0]).toMatchObject({
      authorName: "Camille Moreau",
      text: "Edited words",
    });
  });

  it("reports changed provider markup when stable text identity is missing or ambiguous", async () => {
    const html =
      '<article class="testimonial-card text-testimonial"><span class="font-bold">Lina</span><div class="show-more-text">Original words</div></article>';
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => new Response(html)),
    );
    await expect(
      previewWall("https://testimonial.to/atelier/all"),
    ).rejects.toMatchObject({ code: "SOURCE_FORMAT_CHANGED" });
    const conflicting =
      withTestimonialIds(html, ["first-proof"]) +
      withTestimonialIds(html, ["second-proof"]);
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => new Response(conflicting)),
    );
    await expect(
      previewWall("https://testimonial.to/atelier/all"),
    ).rejects.toMatchObject({ code: "SOURCE_FORMAT_CHANGED" });
  });

  it.each([
    "https://senja.io/p/atelier/wall-of-love",
    "https://senja.io/p/atelier/testimonials",
    "https://senja.io/p/atelier/6jdm3C",
  ])(
    "reads public Senja wall %s and excludes private source fields",
    async (url) => {
      vi.stubGlobal(
        "fetch",
        vi.fn().mockResolvedValue(
          new Response(
            `<script>
      start({data:{reviews:[{id:"review-123",text:"Merci [encore] !",type:"text",
      customer:{name:"Camille Robert",tagline:"Fondatrice",email_md5:"private"},
      media_asset:{metadata:{confidence:.99787}},private_note:"never expose"}]}});
    </script>`,
            { headers: { "content-type": "text/html" } },
          ),
        ),
      );
      const preview = await previewWall(url);
      expect(preview.items).toEqual([
        {
          sourceId: "review-123",
          type: "text",
          text: "Merci [encore] !",
          authorName: "Camille Robert",
          tagline: "Fondatrice",
        },
      ]);
    },
  );

  it("includes Senja video candidates and a declared public static rendition", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        new Response(`<script>start({reviews:[
      {id:"video-1",type:"video",text:"Le produit nous aide.",customer:{name:"Camille"},media_asset:{metadata:{playback_ids:[{id:"publicPlayback",policy:"public"}],static_renditions:{status:"ready",files:[{name:"high.mp4",ext:"mp4"}]}}}},
      {id:"video-2",type:"video",text:"",customer:{name:"Lucie"},media_asset:null}
    ]});</script>`),
      ),
    );
    expect(
      (await previewWall("https://senja.io/p/atelier/wall-of-love")).items,
    ).toEqual([
      {
        sourceId: "video-1",
        type: "video",
        text: "Le produit nous aide.",
        authorName: "Camille",
        videoUrl: "https://stream.mux.com/publicPlayback/high.mp4",
      },
      {
        sourceId: "video-2",
        type: "video",
        text: "",
        authorName: "Lucie",
        unavailableReason: "VIDEO_SOURCE_UNAVAILABLE",
      },
    ]);
  });

  it("reads Testimonial.to video metadata only for a video visible in the wall", async () => {
    const flight =
      "1:" +
      JSON.stringify([
        "$",
        "player",
        null,
        {
          testimonialId: "video-123",
          authorName: "Lucie",
          mp4Fallback: "https://stream.mux.com/playback/high.mp4",
        },
      ]) +
      "\n";
    vi.stubGlobal(
      "fetch",
      vi
        .fn()
        .mockResolvedValue(
          new Response(
            '<div class="testimonial-card"><div id="unified-video-video-123"></div></div><script>self.__next_f.push(' +
              JSON.stringify([1, flight]) +
              ")</script>",
          ),
        ),
    );
    expect(
      (await previewWall("https://testimonial.to/atelier/all")).items,
    ).toEqual([
      {
        sourceId: "video-123",
        type: "video",
        authorName: "Lucie",
        text: "",
        videoUrl: "https://stream.mux.com/playback/high.mp4",
      },
    ]);
  });
});

it("converts Senja highlight markup into visible testimonial words", async () => {
  vi.stubGlobal(
    "fetch",
    vi
      .fn()
      .mockResolvedValue(
        new Response(
          `<script>start({data:{reviews:[{id:"marked-review",type:"text",text:"Une <mark>super expérience</mark> !",customer:{name:"Camille"}}]}});</script>`,
          { headers: { "content-type": "text/html" } },
        ),
      ),
  );
  try {
    const preview = await previewWall(
      "https://senja.io/p/atelier/testimonials",
    );
    expect(preview.items[0]?.text).toBe("Une super expérience !");
    expect(preview.items[0]?.richText).toEqual([
      {
        type: "p",
        children: [
          { text: "Une " },
          { text: "super expérience", highlight: true },
          { text: " !" },
        ],
      },
    ]);
  } finally {
    vi.unstubAllGlobals();
  }
});

it("keeps paragraph boundaries and decoded words while dropping unsafe HTML", async () => {
  vi.stubGlobal(
    "fetch",
    vi
      .fn()
      .mockResolvedValue(
        new Response(
          `<script>start({data:{reviews:[{id:"formatted",type:"text",text:"<p>Merci &amp; <mark>bravo<br>encore</mark></p><p>2 &lt; 3<script>alert(1)<\\/script></p>",customer:{name:"Camille"}}]}});</script>`,
        ),
      ),
  );
  try {
    const { items } = await previewWall(
      "https://senja.io/p/atelier/testimonials",
    );
    expect(items[0]?.text).toBe("Merci & bravo\nencore\n2 < 3");
    expect(items[0]?.richText).toEqual([
      {
        type: "p",
        children: [{ text: "Merci & " }, { text: "bravo", highlight: true }],
      },
      {
        type: "p",
        children: [{ text: "encore", highlight: true }, { text: "" }],
      },
      { type: "p", children: [{ text: "2 < 3" }] },
    ]);
  } finally {
    vi.unstubAllGlobals();
  }
});
