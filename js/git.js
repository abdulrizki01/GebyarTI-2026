/* ===== Drone 3D: turun saat scroll, mengecil, lalu mondar-mandir men-scan terrain ===== */
const GIT3D = {
  drone: "../img/GIT1.glb", // model drone
  terrain: "../img/GIT2.glb", // model peta/terrain (kalau gagal dimuat, otomatis pakai terrain sederhana)
  heroSize: 0.8, // lebar drone di hero (x lebar panel)
  scanSize: 0.17, // lebar drone saat men-scan (x lebar area peta) -> lebih kecil
  fly: 0.65, // makin kecil = drone turun makin cepat mendahului scroll
  speed: 3.4, // detik per sapuan kiri-kanan
};

(function () {
  const hero = document.getElementById("heroSlot"),
    scan = document.getElementById("scanSlot"),
    cv = document.getElementById("gitfx");
  if (!hero || !scan || !cv) return;
  const msg = hero.querySelector(".msg"),
    say = (t) => {
      if (msg) msg.textContent = t;
    };
  if (!window.THREE || !THREE.GLTFLoader) {
    say("Library 3D gagal dimuat. Cek koneksi internet.");
    return;
  }
  const reduce = matchMedia("(prefers-reduced-motion: reduce)").matches;

  const R = new THREE.WebGLRenderer({
    canvas: cv,
    antialias: true,
    alpha: true,
  });
  R.setPixelRatio(Math.min(devicePixelRatio, 2));
  R.outputEncoding = THREE.sRGBEncoding;
  const scene = new THREE.Scene(),
    D = 14,
    cam = new THREE.PerspectiveCamera(30, 1, 0.1, 200);
  cam.position.z = D;
  scene.add(new THREE.HemisphereLight(0xffffff, 0x1b3a44, 1.0));
  const key = new THREE.DirectionalLight(0xffffff, 1.4);
  key.position.set(4, 6, 6);
  scene.add(key);
  const rim = new THREE.DirectionalLight(0x5ee0d3, 0.8);
  rim.position.set(-5, 2, -4);
  scene.add(rim);

  // posisi elemen di halaman (bukan di layar), diukur ulang saat resize / layout berubah
  let W, H, wpp, hr, sr;
  const pg = (el) => {
    const r = el.getBoundingClientRect();
    return {
      cx: r.left + scrollX + r.width / 2,
      cy: r.top + scrollY + r.height / 2,
      w: r.width,
      h: r.height,
    };
  };
  const measure = () => {
    hr = pg(hero);
    sr = pg(scan);
  };
  const size = () => {
    W = innerWidth;
    H = innerHeight;
    R.setSize(W, H, false);
    cam.aspect = W / H;
    cam.updateProjectionMatrix();
    wpp = (2 * D * Math.tan((cam.fov * Math.PI) / 360)) / H; // satuan dunia per pixel di z = 0
    measure();
  };
  addEventListener("resize", size);
  addEventListener("load", measure);
  new ResizeObserver(measure).observe(document.body);
  size();

  // normalisasi model supaya ukuran maksimalnya = 1 dan berpusat di titik asal
  function norm(model, xz) {
    const bb = new THREE.Box3().setFromObject(model),
      s = bb.getSize(new THREE.Vector3()),
      c = bb.getCenter(new THREE.Vector3());
    model.position.sub(c);
    const inner = new THREE.Group();
    inner.add(model);
    const m = xz ? Math.max(s.x, s.z) : Math.max(s.x, s.y, s.z);
    inner.scale.setScalar(1 / m);
    return { inner, topY: s.y / 2 / m };
  }

  const loader = new THREE.GLTFLoader();
  if (THREE.DRACOLoader) {
    const d = new THREE.DRACOLoader();
    d.setDecoderPath("https://www.gstatic.com/draco/versioned/decoders/1.4.1/");
    loader.setDRACOLoader(d);
  }

  // ---- terrain ----
  const tPivot = new THREE.Group();
  scene.add(tPivot);
  let topY = 0.05;
  const setTerrain = (o) => {
    tPivot.add(o.inner);
    topY = o.topY;
  };
  function fallbackTerrain() {
    const g = new THREE.PlaneGeometry(1, 1, 48, 48);
    g.rotateX(-Math.PI / 2);
    const p = g.attributes.position,
      c = new Float32Array(p.count * 3),
      col = new THREE.Color();
    for (let i = 0; i < p.count; i++) {
      const x = p.getX(i),
        z = p.getZ(i),
        h =
          0.035 * Math.sin(x * 14) * Math.cos(z * 11) +
          0.02 * Math.sin(x * 29 + z * 17);
      p.setY(i, h);
      col.setHSL(0.27 + h * 1.2, 0.45, 0.25 + h * 3);
      c.set([col.r, col.g, col.b], i * 3);
    }
    g.setAttribute("color", new THREE.BufferAttribute(c, 3));
    g.computeVertexNormals();
    const grp = new THREE.Group();
    grp.add(
      new THREE.Mesh(
        g,
        new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.9 }),
      ),
    );
    const base = new THREE.Mesh(
      new THREE.BoxGeometry(1, 0.08, 1),
      new THREE.MeshStandardMaterial({ color: 0x0b1a22, roughness: 1 }),
    );
    base.position.y = -0.06;
    grp.add(base);
    return { inner: grp, topY: 0.04 };
  }
  loader.load(
    GIT3D.terrain,
    (g) => {
      console.log("[GIT3D] terrain dimuat");
      setTerrain(norm(g.scene, true));
    },
    undefined,
    () => {
      console.warn("[GIT3D] terrain gagal dimuat, pakai terrain sederhana");
      setTerrain(fallbackTerrain());
    },
  );

  // area scan (persegi tembus pandang di permukaan terrain) + garis cahaya dari drone
  const fp = new THREE.Group();
  fp.scale.setScalar(0.22);
  tPivot.add(fp);
  const fpMat = new THREE.MeshBasicMaterial({
    color: 0x5ee0d3,
    transparent: true,
    opacity: 0,
    side: THREE.DoubleSide,
    depthWrite: false,
    depthTest: false,
  });
  const quad = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), fpMat);
  quad.rotation.x = -Math.PI / 2;
  fp.add(quad);
  const edgeMat = new THREE.LineBasicMaterial({
    color: 0xaaf5ee,
    transparent: true,
    opacity: 0,
    depthTest: false,
  });
  const edge = new THREE.LineSegments(
    new THREE.EdgesGeometry(new THREE.PlaneGeometry(1, 1)),
    edgeMat,
  );
  edge.rotation.x = -Math.PI / 2;
  fp.add(edge);
  const beamGeo = new THREE.BufferGeometry();
  beamGeo.setAttribute(
    "position",
    new THREE.BufferAttribute(new Float32Array(24), 3),
  );
  const beamMat = new THREE.LineBasicMaterial({
    color: 0x5ee0d3,
    transparent: true,
    opacity: 0,
    depthTest: false,
  });
  const beam = new THREE.LineSegments(beamGeo, beamMat);
  beam.frustumCulled = false;
  scene.add(beam);

  // ---- drone ----
  const drone = new THREE.Group(),
    pitch = new THREE.Group();
  drone.add(pitch);
  drone.visible = false;
  scene.add(drone);
  loader.load(
    GIT3D.drone,
    (g) => {
      g.scene.traverse((o) => {
        if (o.isMesh && o.material && o.material.metalness > 0.6)
          o.material.metalness = 0.35;
      });
      pitch.add(norm(g.scene).inner);
      drone.visible = true;
      say("");
      hero.classList.add("ready");
    },
    (x) => {
      if (x.total)
        say("Memuat model 3D… " + Math.round((x.loaded / x.total) * 100) + "%");
    },
    () =>
      say(
        "Model drone gagal dimuat. Cek path img/GIT1.glb dan jalankan lewat Live Server.",
      ),
  );

  const cl = (v, a = 0, b = 1) => Math.min(Math.max(v, a), b),
    lerp = (a, b, t) => a + (b - a) * t;
  const sm = (t) => t * t * (3 - 2 * t),
    ease = (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);
  const t0 = performance.now(),
    V = THREE.Vector3,
    corners = [
      [-0.5, -0.5],
      [0.5, -0.5],
      [0.5, 0.5],
      [-0.5, 0.5],
    ];

  (function frame(now) {
    requestAnimationFrame(frame);
    if (document.hidden) return;
    const t = (now - t0) / 1000,
      sy = scrollY;

    // progres terbang: 0 = di hero, 1 = sudah di atas peta
    const start = hr.h * 0.15,
      end = start + Math.max(300, sr.cy - hr.cy) * GIT3D.fly;
    const p = cl((sy - start) / (end - start)),
      e = ease(p),
      w = sm(cl((p - 0.75) / 0.25));

    // terrain mengikuti kotak peta di layar
    const tw = Math.min(sr.w * 0.86, sr.h * 1.5);
    tPivot.position.set(
      (sr.cx - W / 2) * wpp,
      -(sr.cy + sr.h * 0.08 - sy - H / 2) * wpp,
      0,
    );
    tPivot.scale.setScalar(tw * wpp);
    tPivot.rotation.set(
      0.5,
      -0.6 + (reduce ? 0 : Math.sin(t * 0.25) * 0.12),
      0,
    );
    const onScreen = sr.cy - sy < H + sr.h && sr.cy - sy > -sr.h;
    tPivot.visible = onScreen;
    beam.visible = onScreen;
    tPivot.updateMatrixWorld(true);

    // jalur terbang (hero -> atas peta), turun duluan mendahului scroll
    const cx = lerp(hr.cx, sr.cx, e),
      cy = lerp(hr.cy, sr.cy - sr.h * 0.28, e);
    const F = new V((cx - W / 2) * wpp, -(cy - sy - H / 2) * wpp, 0);

    // pola sapuan mondar-mandir (lawnmower) dalam koordinat terrain
    const T = GIT3D.speed,
      k = Math.floor(t / T),
      fr = (t / T) % 1,
      dir = k % 2 ? 1 - fr : fr,
      row = k % 3,
      sign = k % 2 ? -1 : 1;
    fp.position.set(
      reduce ? 0 : (dir - 0.5) * 0.7,
      topY,
      reduce ? 0 : (row - 1) * 0.22,
    );
    fp.updateMatrixWorld(true);
    const P = fp.localToWorld(new V(0, 0, 0));
    P.y += tw * wpp * 0.34;
    P.z += tw * wpp * 0.15;
    drone.position.copy(F.lerp(P, w));

    // ukuran: besar di hero -> kecil saat men-scan
    const dpx = lerp(hr.w * GIT3D.heroSize, sr.w * GIT3D.scanSize, e),
      ds = dpx * wpp;
    drone.scale.setScalar(ds);
    drone.position.y += reduce ? 0 : Math.sin(t * 2.2) * ds * 0.03;
    const yaw =
      0.6 + (reduce ? 0 : Math.sin(t * 0.5) * 0.3 * (1 - w)) + sign * 0.3 * w;
    drone.rotation.y += (yaw - drone.rotation.y) * 0.08;
    pitch.rotation.x = Math.sin(p * Math.PI) * 0.3; // hidung menunduk saat meluncur turun
    pitch.rotation.z = -sign * 0.12 * w; // miring ke arah gerak

    // area scan + berkas cahaya hanya muncul saat drone sudah di atas peta
    fpMat.opacity = 0.26 * w;
    edgeMat.opacity = 0.9 * w;
    beamMat.opacity = 0.55 * w;
    const a = beamGeo.attributes.position.array,
      o = drone.position;
    corners.forEach((c, i) => {
      const v = fp.localToWorld(new V(c[0], 0, c[1]));
      a.set([o.x, o.y, o.z, v.x, v.y, v.z], i * 6);
    });
    beamGeo.attributes.position.needsUpdate = true;

    R.render(scene, cam);
  })(t0);
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
    a.addEventListener("click", () => nav.classList.remove("open")),
  );

const rv = document.querySelectorAll(
  ".sec .head, .card, .team article, .work, .gal figure, .sems div, .trio3 > div, .bq, .eco, .cta-in",
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

const links = [...document.querySelectorAll(".anchors a")];
const spy = new IntersectionObserver(
  (es) =>
    es.forEach((e) => {
      if (e.isIntersecting)
        links.forEach((a) =>
          a.classList.toggle(
            "on",
            a.getAttribute("href") === "#" + e.target.id,
          ),
        );
    }),
  { rootMargin: "-45% 0px -50% 0px" },
);
links.forEach((a) => {
  const s = document.querySelector(a.getAttribute("href"));
  if (s) spy.observe(s);
});
