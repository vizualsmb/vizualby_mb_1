-- Seed the studio's confirmed inventory for the pre-shoot checklist.
insert into studio_admin.equipment (name, category, quantity, required)
select name, category, quantity, required
from (values
  ('Panasonic LUMIX S1 II', 'Cameras', 1, true), ('Panasonic GH6', 'Cameras', 1, false),
  ('DJI Air 2S — Drone', 'Drone / Action Cameras', 1, false), ('Insta360 X3', 'Drone / Action Cameras', 1, false), ('DJI Osmo 3', 'Drone / Action Cameras', 1, false),
  ('Sigma 24–70mm f/2.8', 'Lenses', 1, true), ('Sigma 70–200mm f/2.8 DG DN OS — L-Mount', 'Lenses', 1, false), ('Panasonic 50mm f/1.8', 'Lenses', 1, false), ('TTArtisan 14mm f/2.8', 'Lenses', 1, false),
  ('Aputure 600D', 'Lighting', 1, false), ('Amaran 200x', 'Lighting', 1, false), ('SmallRig RC 100C — 100W RGB', 'Lighting', 1, false), ('Godox S30', 'Lighting', 1, false), ('RGB Tube Lights', 'Lighting', 3, false), ('NEEWER 33" Parabolic Softbox', 'Lighting', 1, false),
  ('DJI RS3 Pro Gimbal', 'Stabilization', 1, true), ('SIRUI AM-MDP02 74" Monopod', 'Stabilization', 1, false), ('Hollyland Lark M1 Wireless Microphone', 'Audio', 1, false),
  ('PolarPro PMVND Mist Edition II — 77mm', 'Grip / Accessories', 1, false), ('DJI Batteries', 'Power', 1, true), ('Camera Batteries', 'Power', 1, true), ('Battery Chargers', 'Power', 1, false), ('Light Batteries / Power Cables', 'Power', 1, false), ('SD / Memory Cards', 'Media', 1, true), ('Lens Cleaning Kit', 'Grip / Accessories', 1, false), ('Extension Cords / Power Accessories', 'Grip / Accessories', 1, false)
) as items(name, category, quantity, required)
where not exists (select 1 from studio_admin.equipment e where e.name = items.name and e.archived_at is null);
