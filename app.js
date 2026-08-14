const SUPABASE_URL = "https://cbbadjdznpgnfmzzxsqp.supabase.co";
const SUPABASE_PUBLISHABLE_KEY = "sb_publishable_V5RK31KIWsxkDzrybUfVBg_0RjjQFKh";

const db = window.supabase.createClient(
  SUPABASE_URL,
  SUPABASE_PUBLISHABLE_KEY
);

const $ = (id) => document.getElementById(id);

let user = null;
let mode = "login";

const views = {
  home: $("home"),
  auth: $("auth"),
  shelf: $("shelf"),
};

function view(name) {
  Object.entries(views).forEach(([key, node]) => {
    node.classList.toggle("hidden", key !== name);
  });
  window.scrollTo({ top: 0, behavior: "smooth" });
}

function msg(text, isError = false) {
  const node = $("status");
  node.textContent = text;
  node.className = isError ? "status error" : "status";
  clearTimeout(msg.timer);
  msg.timer = setTimeout(() => node.classList.add("hidden"), 5000);
}

function authUI() {
  const loggedIn = Boolean(user);
  $("authBtn").classList.toggle("hidden", loggedIn);
  $("logoutBtn").classList.toggle("hidden", !loggedIn);
  $("shelfBtn").classList.toggle("hidden", !loggedIn);
  $("heroBtn").textContent = loggedIn ? "내 책장 보기" : "내 책장 만들기";
}

function authMode(nextMode) {
  mode = nextMode;
  const signup = mode === "signup";
  $("authTitle").textContent = signup ? "회원가입" : "로그인";
  $("authSubmit").textContent = signup ? "회원가입" : "로그인";
  $("nicknameWrap").classList.toggle("hidden", !signup);
  $("nickname").required = signup;
  $("toggleAuth").textContent = signup
    ? "이미 계정이 있나요? 로그인"
    : "처음이신가요? 회원가입";
}

function badge(text) {
  const node = document.createElement("span");
  node.className = "badge";
  node.textContent = text;
  return node;
}

function card(book, own = false) {
  const node = $("cardTpl").content.cloneNode(true);
  const image = node.querySelector("img");
  const placeholder = node.querySelector(".cover span");

  if (book.cover_url) {
    image.src = book.cover_url;
    image.alt = `${book.title} 표지`;
    image.onload = () => placeholder.classList.add("hidden");
    image.onerror = () => image.classList.add("hidden");
  } else {
    image.classList.add("hidden");
  }

  node.querySelector(".owner").textContent =
    book.profiles?.nickname ? `${book.profiles.nickname}의 책장` : "";
  node.querySelector(".title").textContent = book.title;
  node.querySelector(".author").textContent = book.author || "저자 미입력";
  node.querySelector(".comment").textContent =
    book.comment || "아직 남긴 코멘트가 없습니다.";

  const badges = node.querySelector(".badges");
  if (book.condition) badges.append(badge(book.condition));
  if (book.available_for_exchange) badges.append(badge("교환 가능"));
  if (book.available_for_sale) {
    badges.append(
      badge(`판매 ${Number(book.sale_price || 0).toLocaleString("ko-KR")}원`)
    );
  }

  if (own) {
    const deleteButton = node.querySelector(".delete");
    deleteButton.classList.remove("hidden");
    deleteButton.onclick = () => delBook(book.id);
  }

  return node;
}

async function publicBooks() {
  const container = $("publicBooks");
  container.innerHTML = "";

  const { data, error } = await db
    .from("books")
    .select(`
      id, owner_id, title, author, comment, condition, cover_url,
      available_for_exchange, available_for_sale, sale_price, created_at,
      profiles ( nickname )
    `)
    .order("created_at", { ascending: false })
    .limit(12);

  if (error) {
    msg(`책 목록 오류: ${error.message}`, true);
    return;
  }

  $("publicEmpty").classList.toggle("hidden", data.length > 0);
  data.forEach((book) => container.append(card(book)));
}

async function profile() {
  const { data, error } = await db
    .from("profiles")
    .select("id, nickname")
    .eq("id", user.id)
    .maybeSingle();

  if (error) throw error;
  if (data) return data;

  const nickname =
    user.user_metadata?.nickname ||
    user.email?.split("@")[0] ||
    "새 독자";

  const result = await db
    .from("profiles")
    .insert({ id: user.id, nickname })
    .select()
    .single();

  if (result.error) throw result.error;
  return result.data;
}

async function myShelf() {
  if (!user) {
    view("auth");
    return;
  }

  try {
    const myProfile = await profile();
    $("shelfName").textContent = myProfile.nickname;

    const { data, error } = await db
      .from("books")
      .select("*")
      .eq("owner_id", user.id)
      .order("created_at", { ascending: false });

    if (error) throw error;

    const container = $("myBooks");
    container.innerHTML = "";
    $("myEmpty").classList.toggle("hidden", data.length > 0);

    data.forEach((book) => {
      book.profiles = { nickname: myProfile.nickname };
      container.append(card(book, true));
    });
  } catch (error) {
    msg(`내 책장 오류: ${error.message}`, true);
  }
}

async function delBook(id) {
  if (!confirm("이 책을 삭제할까요?")) return;

  const { error } = await db.from("books").delete().eq("id", id);

  if (error) {
    msg(`삭제 오류: ${error.message}`, true);
    return;
  }

  msg("책을 삭제했습니다.");
  await Promise.all([myShelf(), publicBooks()]);
}

$("authForm").onsubmit = async (event) => {
  event.preventDefault();

  const email = $("email").value.trim();
  const password = $("password").value;
  const nickname = $("nickname").value.trim();

  if (mode === "signup") {
    const { data, error } = await db.auth.signUp({
      email,
      password,
      options: {
        data: { nickname },
      },
    });

    if (error) {
      msg(`회원가입 실패: ${error.message}`, true);
      return;
    }

    if (data.session) {
      user = data.user;
      authUI();
      await profile();
      view("shelf");
      await myShelf();
      msg("회원가입이 완료되었습니다.");
    } else {
      msg("확인 이메일을 보냈습니다. 인증 후 로그인해 주세요.");
      authMode("login");
    }

    return;
  }

  const { data, error } = await db.auth.signInWithPassword({
    email,
    password,
  });

  if (error) {
    msg(`로그인 실패: ${error.message}`, true);
    return;
  }

  user = data.user;
  authUI();
  await profile();
  view("shelf");
  await myShelf();
  msg("로그인했습니다.");
};


const MAX_COVER_SIZE = 5 * 1024 * 1024;
const ALLOWED_COVER_TYPES = ["image/jpeg", "image/png", "image/webp"];

function resetCoverInput() {
  $("bookCoverFile").value = "";
  $("coverPreview").removeAttribute("src");
  $("coverPreviewWrap").classList.add("hidden");
}

function validateCoverFile(file) {
  if (!file) return null;

  if (!ALLOWED_COVER_TYPES.includes(file.type)) {
    throw new Error("표지는 JPG, PNG 또는 WEBP 파일만 등록할 수 있습니다.");
  }

  if (file.size > MAX_COVER_SIZE) {
    throw new Error("표지 파일은 5MB 이하여야 합니다.");
  }

  return file;
}

async function uploadCover(file) {
  const extension = file.name.split(".").pop()?.toLowerCase() || "jpg";
  const safeExtension = ["jpg", "jpeg", "png", "webp"].includes(extension)
    ? extension
    : "jpg";
  const fileName = `${crypto.randomUUID()}.${safeExtension}`;
  const filePath = `${user.id}/${fileName}`;

  const { error: uploadError } = await db.storage
    .from("book-covers")
    .upload(filePath, file, {
      cacheControl: "3600",
      contentType: file.type,
      upsert: false,
    });

  if (uploadError) throw uploadError;

  const { data } = db.storage
    .from("book-covers")
    .getPublicUrl(filePath);

  return data.publicUrl;
}

$("bookCoverFile").onchange = (event) => {
  try {
    const file = validateCoverFile(event.target.files?.[0]);

    if (!file) {
      resetCoverInput();
      return;
    }

    $("coverPreview").src = URL.createObjectURL(file);
    $("coverPreviewWrap").classList.remove("hidden");
  } catch (error) {
    resetCoverInput();
    msg(error.message, true);
  }
};

$("removeCoverBtn").onclick = () => {
  resetCoverInput();
};

$("bookForm").onsubmit = async (event) => {
  event.preventDefault();

  if (!user) {
    view("auth");
    msg("로그인 후 책을 등록해 주세요.", true);
    return;
  }

  const submitButton = event.submitter;
  const originalText = submitButton.textContent;
  submitButton.disabled = true;
  submitButton.textContent = "등록 중...";

  try {
    const sale = $("bookSale").checked;
    const coverFile = validateCoverFile($("bookCoverFile").files?.[0]);
    const coverUrl = coverFile ? await uploadCover(coverFile) : null;

    const payload = {
      owner_id: user.id,
      title: $("bookTitle").value.trim(),
      author: $("bookAuthor").value.trim() || null,
      cover_url: coverUrl,
      condition: $("bookCondition").value,
      comment: $("bookComment").value.trim() || null,
      available_for_exchange: $("bookExchange").checked,
      available_for_sale: sale,
      sale_price: sale ? Number($("bookPrice").value || 0) : null,
    };

    const { error } = await db.from("books").insert(payload);
    if (error) throw error;

    event.target.reset();
    resetCoverInput();
    $("bookExchange").checked = true;
    $("priceWrap").classList.add("hidden");
    $("bookForm").classList.add("hidden");
    msg("표지와 책 정보를 등록했습니다.");

    await Promise.all([myShelf(), publicBooks()]);
  } catch (error) {
    msg(`등록 오류: ${error.message}`, true);
  } finally {
    submitButton.disabled = false;
    submitButton.textContent = originalText;
  }
};

$("bookSale").onchange = (event) => {
  $("priceWrap").classList.toggle("hidden", !event.target.checked);
};

$("toggleAuth").onclick = () => {
  authMode(mode === "login" ? "signup" : "login");
};

$("homeBtn").onclick = () => {
  view("home");
  publicBooks();
};

$("authBtn").onclick = () => view("auth");

$("heroBtn").onclick = async () => {
  if (user) {
    view("shelf");
    await myShelf();
  } else {
    view("auth");
    authMode("signup");
  }
};

$("shelfBtn").onclick = async () => {
  view("shelf");
  await myShelf();
};

$("bookFormBtn").onclick = () => {
  $("bookForm").classList.toggle("hidden");
};

$("logoutBtn").onclick = async () => {
  await db.auth.signOut();
  user = null;
  authUI();
  view("home");
  msg("로그아웃했습니다.");
};

db.auth.onAuthStateChange((_event, session) => {
  user = session?.user || null;
  authUI();
});

(async () => {
  const { data } = await db.auth.getSession();
  user = data.session?.user || null;
  authUI();
  authMode("login");
  await publicBooks();
})();
