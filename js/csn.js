/* ===== CSN =====
   Empat model = empat keahlian CSN:  rack server (CSN1) · cloud (CSN4) · perisai keamanan (CSN3) · graf jaringan/IoT (CSN2)
   1) Hero    : keempatnya melayang sebagai satu scene, paket data berputar di antaranya
   2) Perjalanan: scroll mengikuti paket data server -> cloud -> keamanan (serangan MITM diblokir perisai) -> IoT        */
const CSN_CFG = {
  models: {
    rack: "../img/CSN1-lite.glb",
    cloud: "../img/CSN4.glb",
    shield: "../img/CSN3-draco.glb",
    graph: "../img/CSN2-draco.glb",
    drone: "../img/GIT1.glb",
  },
  // Belum ada data tim/dokumentasi di PPT. Isi array ini, bagian-nya otomatis muncul di halaman.
  // team:    { name: 'Nama, gelar', role: 'Kepala Lab', field: 'Bidang keahlian', photo: '../img/csn/nama.jpg' }
  // gallery: { title: 'Judul kegiatan', tag: 'TANGGAL / KATEGORI', photo: '../img/csn/g1.jpg' }
  team: [],
  gallery: [],
};

(function () {
  const $ = (id) => document.getElementById(id);
  if (!window.THREE || !THREE.GLTFLoader) {
    document
      .querySelectorAll(".stage .msg")
      .forEach(
        (m) =>
          (m.textContent = "Library 3D gagal dimuat. Cek koneksi internet."),
      );
    return;
  }
  const reduce = matchMedia("(prefers-reduced-motion: reduce)").matches;
  const cl = (v, a = 0, b = 1) => Math.min(Math.max(v, a), b),
    lerp = (a, b, t) => a + (b - a) * t,
    V = THREE.Vector3;
  const lin = (h) => new THREE.Color(h).convertSRGBToLinear();

  const loader = new THREE.GLTFLoader();
  if (THREE.DRACOLoader) {
    const d = new THREE.DRACOLoader();
    d.setDecoderPath("https://www.gstatic.com/draco/versioned/decoders/1.4.1/");
    loader.setDRACOLoader(d);
  }
  const cache = {};
  const get = (k) =>
    cache[k] ||
    (cache[k] = new Promise((ok, no) =>
      loader.load(
        CSN_CFG.models[k],
        (g) => ok(g.scene),
        undefined,
        () => no(k),
      ),
    ));

  function mount(el, fov, z) {
    const R = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    R.setPixelRatio(Math.min(devicePixelRatio, 2));
    R.outputEncoding = THREE.sRGBEncoding;
    el.appendChild(R.domElement);
    const scene = new THREE.Scene(),
      cam = new THREE.PerspectiveCamera(fov, 1, 0.1, 100);
    cam.position.z = z;
    const fns = [];
    let vis = false,
      last = performance.now();
    const fit = () => {
      const w = el.clientWidth,
        h = el.clientHeight;
      if (w && h) {
        R.setSize(w, h, false);
        cam.aspect = w / h;
        cam.updateProjectionMatrix();
      }
    };
    new ResizeObserver(fit).observe(el);
    fit();
    new IntersectionObserver((e) => (vis = e[0].isIntersecting)).observe(el);
    (function loop(now) {
      requestAnimationFrame(loop);
      const dt = Math.min((now - last) / 1000, 0.1);
      last = now;
      if (!vis) return;
      fns.forEach((f) => f(dt, now / 1000));
      R.render(scene, cam);
    })(last);
    return { el, scene, cam, on: (f) => fns.push(f) };
  }
  const norm = (obj, size) => {
    const bb = new THREE.Box3().setFromObject(obj),
      s = bb.getSize(new V()),
      c = bb.getCenter(new V());
    obj.position.sub(c);
    const g = new THREE.Group();
    g.add(obj);
    g.scale.setScalar(size / Math.max(s.x, s.y, s.z));
    return g;
  };
  const ready = (S) => {
    S.el.classList.add("ready");
  };
  const fail = (S, t) => {
    S.el.classList.add("fail");
    const m = S.el.querySelector(".msg");
    if (m) m.textContent = t;
  };
  const mouse = { x: 0, y: 0 };
  addEventListener("pointermove", (e) => {
    mouse.x = (e.clientX / innerWidth) * 2 - 1;
    mouse.y = (e.clientY / innerHeight) * 2 - 1;
  });

  // ---- material ----
  const M = {
    rack: new THREE.MeshStandardMaterial({
      color: 0x2c55c4,
      metalness: 0.55,
      roughness: 0.35,
    }),
    cable: new THREE.MeshStandardMaterial({
      color: 0x46c8f0,
      emissive: 0x46c8f0,
      emissiveIntensity: 0.9,
    }),
    cloud: new THREE.MeshStandardMaterial({
      color: 0xeaf2ff,
      roughness: 0.65,
      emissive: 0x2a4a8a,
      emissiveIntensity: 0.45,
    }),
    shF: new THREE.MeshStandardMaterial({
      color: 0x46c8f0,
      metalness: 0.6,
      roughness: 0.3,
      emissive: 0x0a5a80,
      emissiveIntensity: 0.5,
    }),
    shD: new THREE.MeshStandardMaterial({
      color: 0x101a4a,
      metalness: 0.6,
      roughness: 0.4,
    }),
    shS: new THREE.MeshStandardMaterial({
      color: 0x8a96c8,
      metalness: 0.7,
      roughness: 0.35,
    }),
  };
  // graf: putih di pusat -> cyan -> ungu di tepi, plus gelombang cahaya (uW) yang merambat dari pusat
  function graphMat(geo) {
    geo.computeBoundingSphere();
    const U = {
      uC: { value: geo.boundingSphere.center.clone() },
      uR: { value: geo.boundingSphere.radius },
      uW: { value: -1 },
      uA: { value: lin("#ffffff") },
      uB: { value: lin("#7fdcff") },
      uD: { value: lin("#5a4ac0") },
      uE: { value: lin("#46c8f0") },
    };
    const m = new THREE.MeshStandardMaterial({
      roughness: 0.5,
      metalness: 0.1,
    });
    m.userData.U = U;
    m.onBeforeCompile = (sh) => {
      Object.assign(sh.uniforms, U);
      sh.vertexShader = sh.vertexShader
        .replace("#include <common>", "#include <common>\nvarying vec3 vP;")
        .replace(
          "#include <begin_vertex>",
          "#include <begin_vertex>\nvP = position;",
        );
      sh.fragmentShader = sh.fragmentShader
        .replace(
          "#include <common>",
          "#include <common>\nvarying vec3 vP; uniform vec3 uC,uA,uB,uD,uE; uniform float uR,uW;",
        )
        .replace(
          "#include <color_fragment>",
          `#include <color_fragment>
          float r = clamp(length(vP - uC) / uR, 0.0, 1.0);
          diffuseColor.rgb = r < 0.5 ? mix(uA, uB, r / 0.5) : mix(uB, uD, (r - 0.5) / 0.5);`,
        )
        .replace(
          "#include <emissivemap_fragment>",
          `#include <emissivemap_fragment>
          float ring = exp(-pow((length(vP - uC) - uW) / (uR * 0.12), 2.0)) * step(0.0, uW);
          totalEmissiveRadiance += uE * ring * 2.4;`,
        );
    };
    return m;
  }
  async function build(kind, size) {
    const src = (await get(kind)).clone(true);
    src.traverse((o) => {
      if (!o.isMesh) return;
      if (kind === "rack") o.material = /cube/i.test(o.name) ? M.rack : M.cable;
      else if (kind === "cloud") o.material = M.cloud;
      else if (kind === "shield") {
        const n = (o.material && o.material.name) || "";
        o.material = /gold/i.test(n) ? M.shF : /black/i.test(n) ? M.shD : M.shS;
      } else if (kind === "graph") {
        o.geometry = o.geometry.clone();
        o.material = graphMat(o.geometry);
      }
    });
    return norm(src, size);
  }
  const lights = (S) => {
    S.scene.add(new THREE.HemisphereLight(0xffffff, 0x1a2058, 0.9));
    const k = new THREE.DirectionalLight(0xffffff, 1.2);
    k.position.set(3, 5, 6);
    S.scene.add(k);
    const r = new THREE.DirectionalLight(0x46c8f0, 1.4);
    r.position.set(-5, 1, -3);
    S.scene.add(r);
    const v = new THREE.PointLight(0x6c4de6, 1.3, 30);
    v.position.set(3, -2, 4);
    S.cam.add(v);
    S.scene.add(S.cam);
  };
  // paket data: bola bercahaya + jejak
  function packet(scene, color) {
    const N = 40,
      g = new THREE.Group(),
      core = new THREE.Mesh(
        new THREE.SphereGeometry(0.11, 16, 16),
        new THREE.MeshBasicMaterial({ color: 0xffffff }),
      );
    const light = new THREE.PointLight(color, 1.6, 5);
    g.add(core, light);
    const pos = new Float32Array(N * 3),
      col = new Float32Array(N * 3),
      c = new THREE.Color(color);
    for (let i = 0; i < N; i++) {
      const f = 1 - i / N;
      col.set([c.r * f, c.g * f, c.b * f], i * 3);
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute("position", new THREE.BufferAttribute(pos, 3));
    geo.setAttribute("color", new THREE.BufferAttribute(col, 3));
    const trail = new THREE.Points(
      geo,
      new THREE.PointsMaterial({
        size: 0.13,
        vertexColors: true,
        transparent: true,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
      }),
    );
    trail.frustumCulled = false;
    scene.add(g, trail);
    let first = true;
    return {
      g,
      mat: core.material,
      light,
      set(p) {
        g.position.copy(p);
        if (first) {
          for (let i = 0; i < N; i++) pos.set([p.x, p.y, p.z], i * 3);
          first = false;
        }
        pos.copyWithin(3, 0, (N - 1) * 3);
        pos.set([p.x, p.y, p.z], 0);
        geo.attributes.position.needsUpdate = true;
      },
      show(v) {
        g.visible = trail.visible = v;
      },
    };
  }

  /* ---------- 1) HERO ---------- */
  (function () {
    const el = $("csnhero");
    if (!el) return;
    const S = mount(el, 30, 10.2);
    lights(S);
    const grp = new THREE.Group();
    S.scene.add(grp);
    const items = [];
    let ringGroup;

    build("rack", 2.75)
      .then((rack) => {
        rack.position.set(0, -0.12, 0);
        rack.rotation.set(-0.04, 0.42, 0);
        grp.add(rack);
        items.push(rack);

        ringGroup = new THREE.Group();
        ringGroup.position.set(0, -0.12, -0.12);
        grp.add(ringGroup);

        [2.15, 3.05, 3.95].forEach((radius, i) => {
          const ring = new THREE.Mesh(
            new THREE.TorusGeometry(radius, i === 0 ? 0.018 : 0.012, 8, 96),
            new THREE.MeshBasicMaterial({
              color: i === 1 ? 0x6c4de6 : 0x46c8f0,
              transparent: true,
              opacity: i === 0 ? 0.48 : 0.22,
            }),
          );
          ring.rotation.x = Math.PI / 2.25 + i * 0.16;
          ring.rotation.z = i * 0.42;
          ringGroup.add(ring);
        });

        const nodePositions = [
          [-2.55, 1.05, 0.2],
          [-1.95, -1.65, 0.65],
          [2.45, 1.1, 0.15],
          [1.75, -1.72, 0.55],
        ];
        nodePositions.forEach((pos, i) => {
          const node = new THREE.Mesh(
            new THREE.SphereGeometry(i % 2 ? 0.09 : 0.13, 16, 16),
            new THREE.MeshStandardMaterial({
              color: i % 2 ? 0x7f6ae8 : 0x46c8f0,
              emissive: i % 2 ? 0x2d1d74 : 0x167f9f,
              emissiveIntensity: 0.8,
              metalness: 0.15,
              roughness: 0.3,
            }),
          );
          node.position.set(...pos);
          ringGroup.add(node);

          const lineGeo = new THREE.BufferGeometry().setFromPoints([
            node.position.clone(),
            new THREE.Vector3(0, 0, 0),
          ]);
          ringGroup.add(
            new THREE.Line(
              lineGeo,
              new THREE.LineBasicMaterial({
                color: 0x46c8f0,
                transparent: true,
                opacity: 0.16,
              }),
            ),
          );
        });

        ready(S);
      })
      .catch((k) =>
        fail(
          S,
          'Model "' +
            k +
            '" gagal dimuat. Cek path di CSN_CFG dan pakai Live Server.',
        ),
      );

    S.on((dt, t) => {
      if (!items.length) return;
      grp.rotation.y +=
        (mouse.x * 0.4 +
          (reduce ? 0 : Math.sin(t * 0.22) * 0.12) -
          grp.rotation.y) *
        0.05;
      grp.rotation.x += (mouse.y * 0.18 - grp.rotation.x) * 0.05;
      items[0].position.y =
        -0.12 + (reduce ? 0 : Math.sin(t * 1.05) * 0.045);
      if (ringGroup) ringGroup.rotation.z = reduce ? 0 : t * 0.08;
    });
  })();

  /* ---------- 2) PERJALANAN PAKET (scroll) ---------- */
  (function () {
    const el = $("journey"),
      pin = $("perjalanan");
    if (!el || !pin) return;
    const S = mount(el, 32, 9.5);
    lights(S);
    const hud = $("hud"),
      fill = el.querySelector(".bar i"),
      steps = [...pin.querySelectorAll(".stages li")];
    const X = [0, 5.4, 10.8, 16.2],
      SH = X[2];
    Promise.all([
      build("rack", 2.6),
      build("cloud", 3.2),
      build("shield", 2.6),
      build("graph", 4.2),
      build("drone", 1.45),
    ])
      .then(([r, c, s, g, d]) => {
        r.position.set(X[0], -0.1, 0);
        r.rotation.y = 0.6;
        c.position.set(X[1], 1.1, -0.3);
        s.position.set(X[2], 0.1, 0);
        g.position.set(X[3], 0.3, -0.4);
        d.position.set(X[3] + 1.35, 2.05, 0.25);
        d.rotation.set(-0.12, -0.35, 0.04);
        [r, c, s, g, d].forEach((o) => S.scene.add(o));
        S.parts = { r, c, s, g, d };
        ready(S);
      })
      .catch((k) =>
        fail(
          S,
          'Model "' +
            k +
            '" gagal dimuat. Cek path di CSN_CFG dan pakai Live Server.',
        ),
      );

    // jalur kabel + paket aman
    const path = new THREE.CatmullRomCurve3(
      [-1.5, 0.9, 3.3, 5.7, 8.1, 10.5, 12.9, 15.3, 17.7].map(
        (x, i) =>
          new V(x, [-0.5, -0.4, 0.3, 0.8, 0.5, 0, 0.2, 0.3, 0.2][i], 0.9),
      ),
    );
    S.scene.add(
      new THREE.Line(
        new THREE.BufferGeometry().setFromPoints(path.getPoints(240)),
        new THREE.LineBasicMaterial({
          color: 0x46c8f0,
          transparent: true,
          opacity: 0.22,
        }),
      ),
    );
    const good = packet(S.scene, 0x46c8f0),
      bad = packet(S.scene, 0xff3b5c);
    const ring = new THREE.Mesh(
      new THREE.RingGeometry(0.9, 1.0, 48),
      new THREE.MeshBasicMaterial({
        color: 0xff7a90,
        transparent: true,
        opacity: 0,
        side: THREE.DoubleSide,
        depthWrite: false,
      }),
    );
    ring.position.set(SH + 0.3, 0.2, 0.8);
    S.scene.add(ring);
    const A = new V(SH + 4.2, 2.4, 0.9),
      B = new V(SH + 0.4, 0.2, 0.7),
      C = new V(SH + 3.6, 3.1, 0.7);

    let act = -1,
      txt = "",
      camX = 0;
    const say = (t, warn) => {
      if (t !== txt) {
        txt = t;
        hud.textContent = t;
        hud.classList.toggle("warn", !!warn);
      }
    };
    S.on((dt, t) => {
      const b = pin.getBoundingClientRect(),
        p = cl(-b.top / (b.height - innerHeight));
      camX += (p * X[3] - camX) * Math.min(1, dt * 7);
      S.cam.position.set(camX, 0.5, 9.5);
      S.cam.lookAt(camX, 0.1, 0);
      good.set(path.getPointAt(p));
      good.light.intensity = 1.4 + Math.sin(t * 6) * 0.3;

      // serangan MITM: mendekati perisai, memantul, ditolak
      const s = (p - 0.55) / 0.27;
      let flash = 0,
        blocked = false;
      if (s > 0 && s < 1) {
        const k = s < 0.5 ? s / 0.5 : (s - 0.5) / 0.5;
        bad.show(true);
        bad.set(s < 0.5 ? A.clone().lerp(B, k) : B.clone().lerp(C, k));
        flash = Math.exp(-Math.pow((s - 0.5) / 0.06, 2));
        blocked = s > 0.45;
        ring.material.opacity = s > 0.5 ? (1 - k) * 0.8 : 0;
        ring.scale.setScalar(0.4 + (s > 0.5 ? k * 5 : 0));
      } else {
        bad.show(false);
        ring.material.opacity = 0;
      }
      M.shF.emissiveIntensity =
        0.5 + flash * 3 + (S.parts ? 0.15 * Math.sin(t * 2) : 0);
      if (S.parts) {
        S.parts.s.rotation.y = Math.sin(t * 0.7) * 0.18;
        S.parts.c.position.y = 1.1 + (reduce ? 0 : Math.sin(t * 1.1) * 0.1);
        S.parts.g.rotation.y = reduce ? 0 : t * 0.15;
        S.parts.d.position.y =
          2.05 + (reduce ? 0 : Math.sin(t * 1.35) * 0.12);
        S.parts.d.rotation.y = -0.35 + Math.sin(t * 0.35) * 0.18;
        S.parts.g.traverse((m) => {
          if (m.isMesh && m.material.userData.U) {
            const U = m.material.userData.U,
              a = (t % 4) / 4;
            U.uW.value = p > 0.8 ? a * U.uR.value * 2.1 : -1;
          }
        });
      }

      const i = Math.round(p * 3);
      if (i !== act) {
        act = i;
        steps.forEach((li, n) => li.classList.toggle("on", n === i));
      }
      if (i === 0) say("PAKET: MELEWATI SERVER & LAN");
      else if (i === 1) say("PAKET: MASUK CLOUD · AWS · AZURE · OPENSTACK");
      else if (i === 2)
        blocked
          ? say("ANCAMAN MITM TERDETEKSI → DIBLOKIR ✓", true)
          : say("PAKET: MELEWATI FIREWALL · IDS/IPS · VPN");
      else say("PAKET: TERSAMBUNG KE PERANGKAT IoT & DRONE");
      if (fill) fill.style.width = (p * 100).toFixed(1) + "%";
    });
  })();
})();

/* ===== UI ===== */
const burger = document.querySelector(".burger"),
  nav = document.getElementById("nav");
burger.addEventListener("click", () =>
  burger.setAttribute("aria-expanded", nav.classList.toggle("open")),
);
nav
  .querySelectorAll("a")
  .forEach((a) =>
    a.addEventListener("click", () => {
      nav.classList.remove("open");
      burger.setAttribute("aria-expanded", "false");
    }),
  );

// bagian opsional: tampil otomatis kalau datanya diisi di CSN_CFG
const esc = (s) =>
  String(s).replace(
    /[&<>"]/g,
    (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c],
  );
if (CSN_CFG.team.length) {
  document.getElementById("teamList").innerHTML = CSN_CFG.team
    .map(
      (p) =>
        `<article><figure class="ph"><img src="${esc(p.photo || "")}" alt="${esc(p.name)}" onerror="this.remove()" /></figure><small class="mono">${esc((p.role || "DOSEN").toUpperCase())}</small><h3>${esc(p.name)}</h3><p>${esc(p.field || "")}</p></article>`,
    )
    .join("");
  document.getElementById("tim").hidden = false;
}
if (CSN_CFG.gallery.length) {
  document.getElementById("galList").innerHTML = CSN_CFG.gallery
    .map(
      (g) =>
        `<figure><span class="ph"><img src="${esc(g.photo || "")}" alt="" onerror="this.remove()" /></span><small class="mono">${esc(g.tag || "")}</small><figcaption>${esc(g.title)}</figcaption></figure>`,
    )
    .join("");
  document.getElementById("hidup").hidden = false;
}
const rv = document.querySelectorAll(
  ".sec .head, .cols4 article, .topics article, .cols3 article, .rows li, .jobs a, .team article, .gal figure, .two > div:first-child, .cta-in",
);
rv.forEach((e) => e.classList.add("rv"));
const io = new IntersectionObserver(
  (es) =>
    es.forEach((e) => {
      if (e.isIntersecting) {
        e.target.classList.add("in");
        io.unobserve(e.target);
      }
    }),
  { threshold: 0.1 },
);
rv.forEach((e) => io.observe(e));
