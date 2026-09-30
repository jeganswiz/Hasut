import { isMemberPath, loginHref, showWhenSignedIn } from "./member-nav";

describe("member nav", () => {
  it("hides member links until a session is confirmed", () => {
    expect(showWhenSignedIn(true, "unknown")).toBe(false);
    expect(showWhenSignedIn(true, "guest")).toBe(false);
    expect(showWhenSignedIn(true, "member")).toBe(true);
    expect(showWhenSignedIn(false, "guest")).toBe(true);
  });

  it("treats the composer and inbox as member pages, and a watched story as public", () => {
    expect(isMemberPath("/story")).toBe(true);
    expect(isMemberPath("/connections")).toBe(true);
    expect(isMemberPath("/inbox")).toBe(true);
    expect(isMemberPath("/me")).toBe(true);
    expect(isMemberPath("/conversations/abc")).toBe(true);
    expect(isMemberPath("/stories/member-1")).toBe(false);
    expect(isMemberPath("/")).toBe(false);
  });

  it("keeps the return path on the sign-in link", () => {
    expect(loginHref("/story")).toBe("/login?next=%2Fstory");
  });
});
