/* ===== Model 3D SE =====
   Warna ditentukan oleh POSISI DI LAYAR, bukan oleh bagian modelnya.
   Bagian mana pun yang sedang ada di kanan = pink terang, di kiri = gelap, tengah = gradasi.
   Model berputar 360°, warnanya terus berubah mengikuti area. */
const SE3D = {
  src: '../img/SE4.glb',     // <- sesuaikan dengan nama file hasil export lu
  colors: ['#1a0f4a', '#4326a0', '#a649b0', '#ff80d2'],   // kiri (gelap) -> kanan (terang)
  range: 1.5,                // setengah lebar area gradasi di layar (kecilkan = kontras makin tajam)
  metalness: 0.3,
  roughness: 0.3,
  clearcoat: 0.7,
  tilt: -0.12,               // kemiringan (radian)
  spin: 0.25                 // kecepatan putar (radian/detik), 0 = diam
};

(function () {
  const box = document.getElementById('se3d');
  if (!box) return;
  if (!window.THREE || !THREE.GLTFLoader) { box.classList.add('fail'); box.firstElementChild.textContent = 'Library 3D gagal dimuat. Cek koneksi internet.'; return; }

  const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const scene = new THREE.Scene();
  const cam = new THREE.PerspectiveCamera(32, 1, 0.1, 100);
  cam.position.set(0, 0.2, 7);
  const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
  renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
  renderer.outputEncoding = THREE.sRGBEncoding;
  const el = renderer.domElement;
  el.style.touchAction = 'pan-y';
  box.appendChild(el);

  // cahaya tetap di layar: kanan lebih terang, kiri redup
  scene.add(new THREE.HemisphereLight(0xb9a8ff, 0x120a30, 0.55));
  const keyR = new THREE.DirectionalLight(0xffa0e0, 1.3); keyR.position.set(6, 2, 4); scene.add(keyR);
  const fillL = new THREE.DirectionalLight(0x4a3ad8, 0.15); fillL.position.set(-5, 1, 3); scene.add(fillL);
  const rim = new THREE.DirectionalLight(0xffffff, 0.5); rim.position.set(0, 5, -3); scene.add(rim);

  // material: gradasi dihitung di shader dari posisi x di ruang kamera (= posisi di layar)
  const st = SE3D.colors.map(c => new THREE.Color(c).convertSRGBToLinear());
  const mat = new THREE.MeshPhysicalMaterial({
    metalness: SE3D.metalness, roughness: SE3D.roughness, clearcoat: SE3D.clearcoat, clearcoatRoughness: 0.25
  });
  mat.onBeforeCompile = sh => {
    sh.uniforms.uC0 = { value: st[0] }; sh.uniforms.uC1 = { value: st[1] };
    sh.uniforms.uC2 = { value: st[2] }; sh.uniforms.uC3 = { value: st[3] };
    sh.uniforms.uR = { value: SE3D.range };
    sh.vertexShader = sh.vertexShader
      .replace('#include <common>', '#include <common>\nvarying float vSEx;')
      .replace('#include <begin_vertex>', '#include <begin_vertex>\nvSEx = (modelViewMatrix * vec4(transformed, 1.0)).x;');
    sh.fragmentShader = sh.fragmentShader
      .replace('#include <common>', '#include <common>\nvarying float vSEx;\nuniform vec3 uC0; uniform vec3 uC1; uniform vec3 uC2; uniform vec3 uC3; uniform float uR;')
      .replace('#include <color_fragment>', `#include <color_fragment>
        float t = clamp((vSEx + uR) / (2.0 * uR), 0.0, 1.0);
        vec3 gc = t < 0.3333 ? mix(uC0, uC1, t / 0.3333)
                : t < 0.6667 ? mix(uC1, uC2, (t - 0.3333) / 0.3334)
                : mix(uC2, uC3, (t - 0.6667) / 0.3333);
        diffuseColor.rgb = gc;`);
  };

  let holder = null;
  new THREE.GLTFLoader().load(SE3D.src, gltf => {
    const model = gltf.scene;
    let n = 0;
    model.traverse(m => { if (m.isMesh) { n++; m.material = mat; console.log('[SE3D] mesh:', m.name || '(tanpa nama)'); } });
    console.log('[SE3D] file terbaca. Jumlah mesh:', n);
    if (!n) {
      box.classList.add('fail');
      box.firstElementChild.textContent = 'File .glb terbaca tapi isinya kosong (0 mesh). Export ulang dari Blender: pilih objek, centang Selected Objects + Apply Modifiers.';
      return;
    }
    const bb = new THREE.Box3().setFromObject(model), size = bb.getSize(new THREE.Vector3()), ctr = bb.getCenter(new THREE.Vector3());
    model.position.sub(ctr);
    holder = new THREE.Group(); holder.add(model);
    holder.scale.setScalar(3.4 / Math.max(size.x, size.y, size.z));
    holder.rotation.x = SE3D.tilt;
    scene.add(holder);
    box.classList.add('ready');
  }, undefined, () => {
    box.classList.add('fail');
    box.firstElementChild.textContent = 'Model gagal dimuat. Cek path ' + SE3D.src + ' dan jalankan lewat server lokal (Live Server).';
  });

  // seret untuk memutar sendiri; lepas = lanjut putar otomatis
  let drag = false, lastX = 0, user = 0, auto = 0;
  el.addEventListener('pointerdown', e => { drag = true; lastX = e.clientX; el.setPointerCapture(e.pointerId); });
  el.addEventListener('pointermove', e => { if (drag) { user += (e.clientX - lastX) * 0.01; lastX = e.clientX; } });
  ['pointerup', 'pointercancel'].forEach(ev => el.addEventListener(ev, () => { drag = false; }));

  function resize() {
    const w = box.clientWidth, h = box.clientHeight;
    renderer.setSize(w, h, false); cam.aspect = w / h; cam.updateProjectionMatrix();
  }
  new ResizeObserver(resize).observe(box); resize();

  let visible = true, last = performance.now();
  new IntersectionObserver(e => visible = e[0].isIntersecting).observe(box);
  (function loop(now) {
    requestAnimationFrame(loop);
    const dt = Math.min((now - last) / 1000, 0.1); last = now;
    if (!visible) return;
    if (!drag && !reduce) auto += dt * SE3D.spin;
    if (holder) holder.rotation.y = auto + user;
    renderer.render(scene, cam);
  })(last);
})();

/* ===== UI ===== */
const burger = document.querySelector('.burger'), nav = document.getElementById('nav');
burger.addEventListener('click', () => burger.setAttribute('aria-expanded', nav.classList.toggle('open')));
nav.querySelectorAll('a').forEach(a => a.addEventListener('click', () => nav.classList.remove('open')));

// reveal saat scroll
const rv = document.querySelectorAll('.sec .head, .two > *, .card, .team article, .work, .gal figure, .cta-in');
rv.forEach(e => e.classList.add('rv'));
const io = new IntersectionObserver(es => es.forEach(e => { if (e.isIntersecting) { e.target.classList.add('in'); io.unobserve(e.target); } }), { threshold: .1 });
rv.forEach(e => io.observe(e));

// highlight anchor bar sesuai section
const links = [...document.querySelectorAll('.anchors a')];
const spy = new IntersectionObserver(es => es.forEach(e => {
  if (e.isIntersecting) links.forEach(a => a.classList.toggle('on', a.getAttribute('href') === '#' + e.target.id));
}), { rootMargin: '-45% 0px -50% 0px' });
links.forEach(a => { const s = document.querySelector(a.getAttribute('href')); if (s) spy.observe(s); });