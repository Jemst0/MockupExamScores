"use client";

import React, { useEffect, useRef } from "react";
import * as THREE from "three";

export default function ThreeSkyCanvas() {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    // Check if user prefers reduced motion
    const prefersReducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    // Scene setup
    const scene = new THREE.Scene();
    scene.fog = new THREE.FogExp2(0xbbe4fc, 0.045);

    // Camera setup
    const camera = new THREE.PerspectiveCamera(
      55,
      window.innerWidth / window.innerHeight,
      0.1,
      100
    );
    camera.position.set(0, 0, 14);

    // Renderer setup with alpha transparency
    const renderer = new THREE.WebGLRenderer({
      alpha: true,
      antialias: true,
      powerPreference: "high-performance",
    });
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.1;
    container.appendChild(renderer.domElement);

    // Lighting
    const ambientLight = new THREE.AmbientLight(0xffffff, 1.2);
    scene.add(ambientLight);

    const sunLight = new THREE.DirectionalLight(0xfffaed, 2.0);
    sunLight.position.set(8, 12, 10);
    scene.add(sunLight);

    const blueRimLight = new THREE.DirectionalLight(0x38bdf8, 1.5);
    blueRimLight.position.set(-10, -5, -4);
    scene.add(blueRimLight);

    // Group for objects with parallax
    const objectsGroup = new THREE.Group();
    scene.add(objectsGroup);

    // Helpers to create 3D academic objects
    // 1. 3D Pencil Mesh
    function create3DPencil(colorHex = 0xf59e0b) {
      const pencilGroup = new THREE.Group();

      // Body (Hexagonal cylinder)
      const bodyGeo = new THREE.CylinderGeometry(0.28, 0.28, 2.2, 6);
      const bodyMat = new THREE.MeshStandardMaterial({
        color: colorHex,
        roughness: 0.3,
        metalness: 0.1,
      });
      const body = new THREE.Mesh(bodyGeo, bodyMat);
      pencilGroup.add(body);

      // Wood cone
      const woodGeo = new THREE.ConeGeometry(0.28, 0.7, 6);
      const woodMat = new THREE.MeshStandardMaterial({
        color: 0xfde68a,
        roughness: 0.6,
      });
      const wood = new THREE.Mesh(woodGeo, woodMat);
      wood.position.y = 1.45;
      pencilGroup.add(wood);

      // Lead tip
      const leadGeo = new THREE.ConeGeometry(0.1, 0.25, 6);
      const leadMat = new THREE.MeshStandardMaterial({
        color: 0x1e293b,
        roughness: 0.2,
      });
      const lead = new THREE.Mesh(leadGeo, leadMat);
      lead.position.y = 1.68;
      pencilGroup.add(lead);

      // Ferrule (metal collar)
      const ferruleGeo = new THREE.CylinderGeometry(0.29, 0.29, 0.35, 12);
      const ferruleMat = new THREE.MeshStandardMaterial({
        color: 0xcbd5e1,
        metalness: 0.8,
        roughness: 0.2,
      });
      const ferrule = new THREE.Mesh(ferruleGeo, ferruleMat);
      ferrule.position.y = -1.25;
      pencilGroup.add(ferrule);

      // Eraser
      const eraserGeo = new THREE.CylinderGeometry(0.27, 0.27, 0.4, 12);
      const eraserMat = new THREE.MeshStandardMaterial({
        color: 0xf43f5e,
        roughness: 0.5,
      });
      const eraser = new THREE.Mesh(eraserGeo, eraserMat);
      eraser.position.y = -1.6;
      pencilGroup.add(eraser);

      return pencilGroup;
    }

    // 2. 3D Open/Closed Book Mesh
    function create3DBook(coverColorHex = 0x0284c7) {
      const bookGroup = new THREE.Group();

      // Cover
      const coverGeo = new THREE.BoxGeometry(1.6, 2.1, 0.35);
      const coverMat = new THREE.MeshStandardMaterial({
        color: coverColorHex,
        roughness: 0.35,
        metalness: 0.1,
      });
      const cover = new THREE.Mesh(coverGeo, coverMat);
      bookGroup.add(cover);

      // Pages inside
      const pagesGeo = new THREE.BoxGeometry(1.5, 2.0, 0.3);
      const pagesMat = new THREE.MeshStandardMaterial({
        color: 0xfffef9,
        roughness: 0.8,
      });
      const pages = new THREE.Mesh(pagesGeo, pagesMat);
      pages.position.x = 0.06;
      bookGroup.add(pages);

      // Spine band
      const spineGeo = new THREE.BoxGeometry(0.12, 2.12, 0.37);
      const spineMat = new THREE.MeshStandardMaterial({
        color: 0xfacc15,
        metalness: 0.3,
        roughness: 0.3,
      });
      const spine = new THREE.Mesh(spineGeo, spineMat);
      spine.position.x = -0.76;
      bookGroup.add(spine);

      return bookGroup;
    }

    // 3. 3D Paper Airplane
    function createPaperPlane() {
      const planeGroup = new THREE.Group();
      const geom = new THREE.BufferGeometry();

      // Folded paper airplane triangle vertices
      const vertices = new Float32Array([
        // Left wing
        0, 0, 1.4,
        -1.1, 0.2, -1.0,
        0, 0.3, -0.8,

        // Right wing
        0, 0, 1.4,
        0, 0.3, -0.8,
        1.1, 0.2, -1.0,

        // Keel center left
        0, 0, 1.4,
        0, -0.4, -0.8,
        -0.2, 0, -0.8,

        // Keel center right
        0, 0, 1.4,
        0.2, 0, -0.8,
        0, -0.4, -0.8,
      ]);

      geom.setAttribute("position", new THREE.BufferAttribute(vertices, 3));
      geom.computeVertexNormals();

      const mat = new THREE.MeshStandardMaterial({
        color: 0xffffff,
        side: THREE.DoubleSide,
        roughness: 0.4,
      });

      const planeMesh = new THREE.Mesh(geom, mat);
      planeGroup.add(planeMesh);
      return planeGroup;
    }

    // 4. Floating 3D Star / Scholar Diamond
    function createScholarDiamond(colorHex = 0x38bdf8) {
      const geo = new THREE.OctahedronGeometry(0.65, 0);
      const mat = new THREE.MeshStandardMaterial({
        color: colorHex,
        metalness: 0.5,
        roughness: 0.15,
        wireframe: false,
      });
      return new THREE.Mesh(geo, mat);
    }

    // Spawn elements at pleasing depth and spread
    interface AnimatedItem {
      mesh: THREE.Object3D;
      basePos: THREE.Vector3;
      rotSpeed: { x: number; y: number; z: number };
      floatSpeed: number;
      floatOffset: number;
    }

    const items: AnimatedItem[] = [];

    // Left side floating items
    const pencil1 = create3DPencil(0x0284c7); // Cyan-Blue Pencil
    pencil1.position.set(-7.5, 3.2, -2.5);
    pencil1.rotation.set(0.6, 0.4, -0.5);
    objectsGroup.add(pencil1);
    items.push({
      mesh: pencil1,
      basePos: pencil1.position.clone(),
      rotSpeed: { x: 0.005, y: 0.007, z: 0.003 },
      floatSpeed: 1.2,
      floatOffset: 0,
    });

    const book1 = create3DBook(0x0369a1); // Deep Navy Book
    book1.position.set(-6.8, -3.0, -1.5);
    book1.rotation.set(0.3, -0.5, 0.2);
    objectsGroup.add(book1);
    items.push({
      mesh: book1,
      basePos: book1.position.clone(),
      rotSpeed: { x: 0.004, y: 0.005, z: 0.002 },
      floatSpeed: 0.9,
      floatOffset: 1.5,
    });

    const diamond1 = createScholarDiamond(0x38bdf8);
    diamond1.position.set(-5.0, 1.2, -3.0);
    objectsGroup.add(diamond1);
    items.push({
      mesh: diamond1,
      basePos: diamond1.position.clone(),
      rotSpeed: { x: 0.01, y: 0.015, z: 0.005 },
      floatSpeed: 1.4,
      floatOffset: 2.2,
    });

    // Right side floating items
    const pencil2 = create3DPencil(0xf59e0b); // Gold DOST Pencil
    pencil2.position.set(7.5, -2.5, -2.0);
    pencil2.rotation.set(-0.4, 0.6, 0.7);
    objectsGroup.add(pencil2);
    items.push({
      mesh: pencil2,
      basePos: pencil2.position.clone(),
      rotSpeed: { x: 0.006, y: -0.006, z: 0.004 },
      floatSpeed: 1.1,
      floatOffset: 3.0,
    });

    const plane1 = createPaperPlane();
    plane1.position.set(6.8, 3.5, -1.0);
    plane1.rotation.set(0.2, -0.4, -0.2);
    plane1.scale.setScalar(0.9);
    objectsGroup.add(plane1);
    items.push({
      mesh: plane1,
      basePos: plane1.position.clone(),
      rotSpeed: { x: 0.003, y: 0.004, z: 0.005 },
      floatSpeed: 1.0,
      floatOffset: 4.1,
    });

    const diamond2 = createScholarDiamond(0xfacc15); // Golden Star
    diamond2.position.set(5.2, -0.8, -2.5);
    objectsGroup.add(diamond2);
    items.push({
      mesh: diamond2,
      basePos: diamond2.position.clone(),
      rotSpeed: { x: 0.012, y: -0.01, z: 0.008 },
      floatSpeed: 1.3,
      floatOffset: 5.0,
    });

    // Floating particles (Scholar Dust)
    const particleCount = 45;
    const particleGeo = new THREE.BufferGeometry();
    const particlePos = new Float32Array(particleCount * 3);

    for (let i = 0; i < particleCount * 3; i += 3) {
      particlePos[i] = (Math.random() - 0.5) * 24;
      particlePos[i + 1] = (Math.random() - 0.5) * 16;
      particlePos[i + 2] = (Math.random() - 0.5) * 10 - 2;
    }

    particleGeo.setAttribute("position", new THREE.BufferAttribute(particlePos, 3));
    const particleMat = new THREE.PointsMaterial({
      color: 0xffffff,
      size: 0.14,
      transparent: true,
      opacity: 0.7,
    });
    const particles = new THREE.Points(particleGeo, particleMat);
    scene.add(particles);

    // Mouse parallax tracking
    let targetX = 0;
    let targetY = 0;
    let currentX = 0;
    let currentY = 0;

    const onPointerMove = (e: MouseEvent | TouchEvent) => {
      let clientX = 0;
      let clientY = 0;
      if ("touches" in e && e.touches.length > 0) {
        clientX = e.touches[0].clientX;
        clientY = e.touches[0].clientY;
      } else if ("clientX" in e) {
        clientX = e.clientX;
        clientY = e.clientY;
      }
      targetX = (clientX / window.innerWidth - 0.5) * 2;
      targetY = -(clientY / window.innerHeight - 0.5) * 2;
    };

    window.addEventListener("mousemove", onPointerMove, { passive: true });
    window.addEventListener("touchmove", onPointerMove, { passive: true });

    // Interactive Star Burst on click
    const onClick = (e: MouseEvent) => {
      // Don't trigger if clicked on an input or button
      if ((e.target as HTMLElement).closest("input, button, a")) return;

      const burstGeo = new THREE.OctahedronGeometry(0.35, 0);
      const burstMat = new THREE.MeshStandardMaterial({
        color: Math.random() > 0.5 ? 0x38bdf8 : 0xfacc15,
        roughness: 0.2,
      });
      const burstMesh = new THREE.Mesh(burstGeo, burstMat);

      // Convert mouse to 3D world pos at z = 2
      const vector = new THREE.Vector3(
        (e.clientX / window.innerWidth) * 2 - 1,
        -(e.clientY / window.innerHeight) * 2 + 1,
        0.5
      );
      vector.unproject(camera);
      const dir = vector.sub(camera.position).normalize();
      const distance = -camera.position.z / dir.z + 2;
      const pos = camera.position.clone().add(dir.multiplyScalar(distance));
      burstMesh.position.copy(pos);

      objectsGroup.add(burstMesh);

      const startTime = performance.now();
      const duration = 1200;

      const animateBurst = () => {
        const elapsed = performance.now() - startTime;
        const progress = elapsed / duration;
        if (progress < 1) {
          burstMesh.position.y += 0.03;
          burstMesh.rotation.x += 0.05;
          burstMesh.rotation.y += 0.05;
          burstMesh.scale.setScalar(Math.max(0.01, 1 - progress));
          requestAnimationFrame(animateBurst);
        } else {
          objectsGroup.remove(burstMesh);
          burstGeo.dispose();
          burstMat.dispose();
        }
      };
      requestAnimationFrame(animateBurst);
    };

    window.addEventListener("click", onClick);

    // Resize handler
    const onResize = () => {
      camera.aspect = window.innerWidth / window.innerHeight;
      camera.updateProjectionMatrix();
      renderer.setSize(window.innerWidth, window.innerHeight);
    };
    window.addEventListener("resize", onResize);

    // Animation loop
    let animId = 0;
    const clock = new THREE.Clock();

    const animate = () => {
      animId = requestAnimationFrame(animate);
      const time = clock.getElapsedTime();

      // Smooth camera parallax interpolation
      if (!prefersReducedMotion) {
        currentX += (targetX - currentX) * 0.05;
        currentY += (targetY - currentY) * 0.05;
        camera.position.x = currentX * 1.5;
        camera.position.y = currentY * 1.0;
        camera.lookAt(0, 0, 0);

        // Animate individual objects (bobbing + rotational tumble)
        items.forEach((item) => {
          item.mesh.rotation.x += item.rotSpeed.x;
          item.mesh.rotation.y += item.rotSpeed.y;
          item.mesh.rotation.z += item.rotSpeed.z;

          item.mesh.position.y =
            item.basePos.y + Math.sin(time * item.floatSpeed + item.floatOffset) * 0.35;
        });

        // Rotate background dust slowly
        particles.rotation.y = time * 0.02;
      }

      renderer.render(scene, camera);
    };

    animate();

    return () => {
      cancelAnimationFrame(animId);
      window.removeEventListener("mousemove", onPointerMove);
      window.removeEventListener("touchmove", onPointerMove);
      window.removeEventListener("click", onClick);
      window.removeEventListener("resize", onResize);

      // Clean up Three.js resources
      renderer.dispose();
      if (container.contains(renderer.domElement)) {
        container.removeChild(renderer.domElement);
      }
    };
  }, []);

  return (
    <div
      ref={containerRef}
      aria-hidden="true"
      className="pointer-events-auto fixed inset-0 z-0 overflow-hidden no-print"
      style={{ touchAction: "none" }}
    />
  );
}
