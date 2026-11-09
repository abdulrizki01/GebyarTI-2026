/* ===== KERIS 3D: tiga panggung =====
   1) Hero  : graf pengetahuan (CSN2) berwarna putih -> amber, mengikuti kursor, klik = gelombang cahaya
   2) Riset : dua gir (KERIS1) diputar oleh scroll, timeline 2019-2024 menyala bergantian
   3) Fasilitas: chip AI (KERIS2_FIX) bereaksi saat spesifikasi di-hover */
const K3D = {
  graph: "../img/CSN2-draco.glb",
  gear: "../img/KERIS1.glb",
  chip: "../img/KERIS2_FIX-draco.glb",
  amber: "#e9b04f",
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
    TAU = Math.PI * 2;
  const lin = (hex) => new THREE.Color(hex).convertSRGBToLinear();

  const loader = new THREE.GLTFLoader();
  if (THREE.DRACOLoader) {
    const d = new THREE.DRACOLoader();
    d.setDecoderPath("https://www.gstatic.com/draco/versioned/decoders/1.4.1/");
    loader.setDRACOLoader(d);
  }

  // panggung: renderer + kamera + loop (berhenti saat tidak terlihat)
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
    return { el, scene, cam, R, on: (f) => fns.push(f) };
  }
  // pusatkan model lalu skalakan agar dimensi terbesarnya = size
  function norm(obj, size) {
    const bb = new THREE.Box3().setFromObject(obj),
      s = bb.getSize(new THREE.Vector3()),
      c = bb.getCenter(new THREE.Vector3());
    obj.position.sub(c);
    const g = new THREE.Group();
    g.add(obj);
    g.scale.setScalar(size / Math.max(s.x, s.y, s.z));
    return g;
  }
  const ready = (S) => {
    S.el.classList.add("ready");
    const m = S.el.querySelector(".msg");
    if (m) m.textContent = "";
  };
  const fail = (S, t) => {
    S.el.classList.add("fail");
    const m = S.el.querySelector(".msg");
    if (m) m.textContent = t;
  };
  const prog = (S, name) => (x) => {
    if (x.total) {
      const m = S.el.querySelector(".msg");
      if (m)
        m.textContent =
          "Memuat " +
          name +
          "… " +
          Math.round((x.loaded / x.total) * 100) +
          "%";
    }
  };
  const mouse = { x: 0, y: 0 };
  addEventListener("pointermove", (e) => {
    mouse.x = (e.clientX / innerWidth) * 2 - 1;
    mouse.y = (e.clientY / innerHeight) * 2 - 1;
  });

  /* ---------- 1) HERO: graf pengetahuan ---------- */
  (function () {
    const el = $("kgraph");
    if (!el) return;
    const S = mount(el, 30, 7.5);
    S.scene.add(new THREE.HemisphereLight(0xffffff, 0x3a2a10, 0.9));
    const key = new THREE.DirectionalLight(0xffe2b0, 1.1);
    key.position.set(3, 4, 5);
    S.scene.add(key);

    // warna berdasarkan jarak dari pusat (putih -> amber -> abu hangat) + gelombang emisi amber
    const U = {
      uC: { value: new THREE.Vector3() },
      uR: { value: 1 },
      uO: { value: new THREE.Vector3() },
      uW: { value: -1 },
      uA: { value: lin("#fffaf0") },
      uB: { value: lin("#f3c56e") },
      uD: { value: lin("#7d7566") },
      uE: { value: lin(K3D.amber) },
    };
    const mat = new THREE.MeshStandardMaterial({
      roughness: 0.5,
      metalness: 0.1,
    });
    mat.onBeforeCompile = (sh) => {
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
          "#include <common>\nvarying vec3 vP; uniform vec3 uC,uO,uA,uB,uD,uE; uniform float uR,uW;",
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
          float ring = exp(-pow((length(vP - uO) - uW) / (uR * 0.12), 2.0)) * step(0.0, uW);
          totalEmissiveRadiance += uE * ring * 2.4;`,
        );
    };

    let grp = null,
      mesh = null,
      t0 = 0,
      spin = 0;
    const fire = (o) => {
      U.uO.value.copy(o);
      t0 = performance.now();
    };
    loader.load(
      K3D.graph,
      (g) => {
        g.scene.traverse((o) => {
          if (o.isMesh) {
            mesh = o;
            o.material = mat;
            o.geometry.computeBoundingSphere();
          }
        });
        if (!mesh) return fail(S, "Graf kosong.");
        U.uR.value = mesh.geometry.boundingSphere.radius;
        U.uC.value.copy(mesh.geometry.boundingSphere.center);
        fire(U.uC.value);
        grp = new THREE.Group();
        grp.add(norm(g.scene, 3.6));
        S.scene.add(grp);
        ready(S);
      },
      prog(S, "graf"),
      () =>
        fail(
          S,
          "Graf gagal dimuat. Cek path " +
            K3D.graph +
            " dan pakai Live Server.",
        ),
    );

    // klik = gelombang cahaya dari titik yang diklik
    const rc = new THREE.Raycaster();
    el.addEventListener("click", (e) => {
      if (!mesh) return;
      const r = el.getBoundingClientRect();
      rc.setFromCamera(
        new THREE.Vector2(
          ((e.clientX - r.left) / r.width) * 2 - 1,
          -(((e.clientY - r.top) / r.height) * 2 - 1),
        ),
        S.cam,
      );
      const h = rc.intersectObject(mesh, false)[0];
      fire(h ? mesh.worldToLocal(h.point.clone()) : U.uC.value);
    });

    S.on((dt, t) => {
      if (!grp) return;
      if (!reduce) spin += dt * 0.12;
      grp.rotation.y += (spin + mouse.x * 0.45 - grp.rotation.y) * 0.06;
      grp.rotation.x += (mouse.y * 0.25 - grp.rotation.x) * 0.06;
      const age = (performance.now() - t0) / 1000;
      U.uW.value = age < 2.4 ? (age / 2.4) * U.uR.value * 2.1 : -1;
      if (age > 6 && !reduce) fire(U.uC.value); // gelombang otomatis dari pusat
    });
  })();

  /* ---------- 2) RISET: gir diputar scroll ---------- */
  (function () {
    const el = $("gears"),
      pin = $("karya");
    if (!el || !pin) return;
    const S = mount(el, 30, 8);
    S.scene.add(new THREE.HemisphereLight(0xffffff, 0x2a1d08, 0.7));
    const k = new THREE.DirectionalLight(0xffffff, 1.5);
    k.position.set(3, 4, 6);
    S.scene.add(k);
    const r = new THREE.DirectionalLight(0xe9b04f, 1.0);
    r.position.set(-5, -2, 3);
    S.scene.add(r);
    const pair = new THREE.Group();
    pair.rotation.set(-0.12, 0.42, 0);
    S.scene.add(pair);
    const gears = [];
    const steps = [...pin.querySelectorAll(".tl li")],
      fill = pin.querySelector(".bar i");

    loader.load(
      K3D.gear,
      (g) => {
        // sumbu gir = sumbu X model -> putar sumbu itu menghadap kamera, spin di sumbunya
        const make = (size, color, x, y, dir) => {
          const m = g.scene.clone(true);
          m.traverse((o) => {
            if (o.isMesh)
              o.material = new THREE.MeshStandardMaterial({
                color,
                metalness: 0.75,
                roughness: 0.35,
                flatShading: true,
              });
          });
          const spinG = new THREE.Group();
          spinG.add(norm(m, size));
          const outer = new THREE.Group();
          outer.rotation.y = Math.PI / 2;
          outer.position.set(x, y, 0);
          outer.add(spinG);
          pair.add(outer);
          gears.push({ spinG, ratio: dir * (2.5 / size) });
        };
        make(2.5, 0xe9b04f, -0.9, -0.6, 1);
        make(1.55, 0xe8e4da, 0.78, 0.71, -1);
        ready(S);
      },
      prog(S, "gir"),
      () => fail(S, "Gir gagal dimuat. Cek path " + K3D.gear),
    );

    let ang = 0,
      act = -1;
    S.on((dt, t) => {
      const b = pin.getBoundingClientRect(),
        p = cl(-b.top / (b.height - innerHeight));
      const target = p * TAU * 3;
      ang += (target - ang) * Math.min(1, dt * 6);
      const a = ang + (reduce ? 0 : t * 0.25);
      gears.forEach((o) => (o.spinG.rotation.x = a * o.ratio));
      pair.rotation.y = 0.42 + Math.sin(p * Math.PI) * 0.25;
      const i = Math.min(3, Math.floor(p * 4));
      if (i !== act) {
        act = i;
        steps.forEach((li, n) => li.classList.toggle("on", n <= i));
      }
      if (fill) fill.style.width = (p * 100).toFixed(1) + "%";
    });
  })();

  /* ---------- 3) FASILITAS: chip AI ---------- */
  (function () {
    const el = $("chip");
    if (!el) return;
    const S = mount(el, 30, 6.8);
    S.scene.add(new THREE.HemisphereLight(0xffffff, 0x2a1d08, 0.8));
    const k = new THREE.DirectionalLight(0xffffff, 1.4);
    k.position.set(-3, 4, 5);
    S.scene.add(k);
    const rim = new THREE.DirectionalLight(0xe9b04f, 1.6);
    rim.position.set(5, 1, -2);
    S.scene.add(rim);
    const glow = new THREE.PointLight(0xe9b04f, 0.8, 8);
    glow.position.set(0, 0, 2.2);
    S.scene.add(glow);

    const aiMat = new THREE.MeshStandardMaterial({
      color: 0x3a2a08,
      emissive: new THREE.Color(K3D.amber),
      emissiveIntensity: 0.8,
      roughness: 0.4,
    });
    let yawG = null,
      yaw = 0,
      want = null,
      spinFast = false;
    loader.load(
      K3D.chip,
      (g) => {
        // klasifikasi bagian berdasarkan jumlah vertex: badan > bola solder > lapisan dalam > teks "AI"
        const ms = [];
        g.scene.traverse((o) => {
          if (o.isMesh) ms.push(o);
        });
        ms.sort(
          (a, b) =>
            b.geometry.attributes.position.count -
            a.geometry.attributes.position.count,
        );
        const mats = [
          new THREE.MeshStandardMaterial({
            color: 0x1b1c1f,
            metalness: 0.55,
            roughness: 0.4,
          }),
          new THREE.MeshStandardMaterial({
            color: 0xd9a441,
            metalness: 0.6,
            roughness: 0.3,
          }),
          new THREE.MeshStandardMaterial({
            color: 0x4a3510,
            metalness: 0.4,
            roughness: 0.5,
          }),
          aiMat,
        ];
        ms.forEach((m, i) => (m.material = mats[Math.min(i, 3)]));
        const face = new THREE.Group();
        face.rotation.y = -Math.PI / 2; // sisi "AI" (+X) menghadap kamera
        face.add(norm(g.scene, 3));
        yawG = new THREE.Group();
        yawG.add(face);
        S.scene.add(yawG);
        ready(S);
      },
      prog(S, "chip"),
      () => fail(S, "Chip gagal dimuat. Cek path " + K3D.chip),
    );

    // hover/fokus pada spesifikasi -> chip bereaksi
    document.querySelectorAll(".spec .row").forEach((r) => {
      const on = () => {
        const v = r.dataset.view;
        spinFast = v === "spin";
        want = v === "front" ? 0 : v === "back" ? Math.PI : null;
      };
      const off = () => {
        want = null;
        spinFast = false;
      };
      r.addEventListener("mouseenter", on);
      r.addEventListener("focus", on);
      r.addEventListener("mouseleave", off);
      r.addEventListener("blur", off);
    });

    S.on((dt, t) => {
      if (!yawG) return;
      if (want !== null) {
        const goal = Math.round((yaw - want) / TAU) * TAU + want;
        yaw += (goal - yaw) * Math.min(1, dt * 5);
      } else yaw += dt * (spinFast ? 4 : reduce ? 0 : 0.35);
      if (spinFast) want = null;
      yawG.rotation.y = yaw + mouse.x * 0.2;
      yawG.rotation.x = 0.1 + mouse.y * 0.15;
      yawG.position.y = reduce ? 0 : Math.sin(t * 1.6) * 0.06;
      aiMat.emissiveIntensity =
        (want === 0 ? 1.6 : 0.8) + Math.sin(t * 2.4) * 0.35;
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
const rv = document.querySelectorAll(
  ".sec .head, .fields article, .progs article, .team > *, .roles div, .gal figure, .about > *, .spec, .amb, .cta-in",
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
