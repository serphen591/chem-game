-- 7.6.0：为教师端、回放和统计补齐 22 个综合实验目录。
-- 仅包含公开课程元数据，不包含学生、教师或认证数据。

insert into public.experiments(
  code, module, chapter, title, difficulty, version,
  reactant_features, product_features, phenomenon, metadata
) values
  ('E01','comprehensive','E01','无标签溶液的证据链鉴别',1,760,'无色未知盐溶液，必须分样并先排除干扰。','以阴性证据、沉淀和气体检验共同推断离子组成。','先加稀盐酸无气泡；再加硝酸钡出现白色沉淀；加碱温热逸出气体使湿润红色石蕊试纸变蓝。',jsonb_build_object('workflow_version','7.6.0','step_count',8,'has_investigation',true,'coverage',array['装置装配','分样','水浴加热','阴性证据','离子复验','组成推断'])),
  ('E02','comprehensive','E02','钠及其含氧化合物的定量探究',1,760,'过氧化钠样品需干燥称量。','量气读数前恢复室温并调平液面，氧气用带火星木条检验。','逐滴加水持续产气，量气管体积增加，带火星木条复燃。',jsonb_build_object('workflow_version','7.6.0','step_count',10,'has_investigation',false,'coverage',array['称量','量气装配','气密性','读数','气体检验'])),
  ('E03','comprehensive','E03','侯氏制碱与碳酸盐滴定',1,760,'低温氨化盐水通入二氧化碳。','NaHCO3析晶、洗涤、焙烧后以双终点滴定核对产品。','析出白色晶体，焙烧得到碳酸钠，滴定出现两个指示剂终点。',jsonb_build_object('workflow_version','7.6.0','step_count',12,'has_investigation',false,'coverage',array['低温制备','抽滤洗涤','焙烧','双终点滴定'])),
  ('E04','comprehensive','E04','氯气制备、净化、性质与尾气处理',1,760,'二氧化锰与浓盐酸在加热条件下制氯气。','氯气经除HCl、干燥、收集、性质检验后由碱液吸收。','产生黄绿色气体，湿润有色布条褪色，尾气被氢氧化钠吸收。',jsonb_build_object('workflow_version','7.6.0','step_count',12,'has_investigation',false,'coverage',array['装配','气密性','净化','干燥','收集','检验','尾气吸收装置'])),
  ('E05','comprehensive','E05','海水提溴与卤素氧化性',1,760,'酸化浓缩卤水后用氯气氧化溴离子。','经吹出、还原吸收、再氧化和萃取分液获得溴。','溴的橙黄色出现，经四氯化碳萃取后下层有机相呈橙红色。',jsonb_build_object('workflow_version','7.6.0','step_count',10,'has_investigation',false,'coverage',array['酸化','氧化','吹出','吸收','再氧化','萃取','尾气'])),
  ('E06','comprehensive','E06','铁、铝及其化合物的连续转化',1,760,'铁铝混合盐溶液用过量碱实现分步沉淀和两性分离。','铁离子以SCN显色复验，铝酸根经酸化重新沉淀。','过量碱后铝沉淀溶解、含铁沉淀保留；铁检验液呈血红色。',jsonb_build_object('workflow_version','7.6.0','step_count',11,'has_investigation',false,'coverage',array['分步沉淀','抽滤','显色复验','两性验证','成品检查'])),
  ('E07','comprehensive','E07','硫酸工业、SO₂性质与烟气脱硫',2,760,'亚硫酸盐加酸制取二氧化硫。','SO2性质、催化氧化和石灰石石膏法脱硫形成完整气路。','酸性高锰酸钾褪色，脱硫浆液生成白色石膏固体。',jsonb_build_object('workflow_version','7.6.0','step_count',12,'has_investigation',false,'coverage',array['发生','气密性','性质','催化氧化','脱硫','石膏检查'])),
  ('E08','comprehensive','E08','合成氨—硝酸工业链',2,760,'氯化铵与碱石灰加热制氨并用碱性干燥剂干燥。','氨催化氧化生成NO，经空气氧化和水吸收形成硝酸。','氨使湿润红色石蕊试纸变蓝；无色NO接触空气变成红棕色NO2。',jsonb_build_object('workflow_version','7.6.0','step_count',11,'has_investigation',false,'coverage',array['制氨','干燥','检验','催化氧化','吸收','尾气'])),
  ('E09','comprehensive','E09','从石英砂到高纯硅与玻璃',2,760,'石英砂先酸洗除杂，再用于碳热还原和玻璃配料。','粗硅经氯化精馏、氢还原得到高纯硅。','得到灰黑色粗硅，净化后沉积较纯硅，玻璃冷却后透明均匀。',jsonb_build_object('workflow_version','7.6.0','step_count',12,'has_investigation',false,'coverage',array['酸洗','碳热还原','氯化精馏','氢还原','玻璃熔制','成品检查'])),
  ('E10','comprehensive','E10','多矿物联合工艺流程',2,760,'矿样粉碎后酸浸并过滤洗涤。','通过pH控制选择性沉淀，洗涤灼烧并检查纯度。','矿样逐渐溶解，调pH产生沉淀，灼烧后获得颜色均一产品。',jsonb_build_object('workflow_version','7.6.0','step_count',11,'has_investigation',false,'coverage',array['粉碎','酸浸','过滤洗涤','沉淀控制','灼烧','纯度'])),
  ('E11','comprehensive','E11','反应热—速率—平衡联动探究',2,760,'以平行样和控制变量比较热效应、速率和平衡。','温度、时间和颜色数据分别对应能量、速率和平衡证据。','中和温度升高，催化或升温使产气加快，血红色平衡体系稀释后变浅。',jsonb_build_object('workflow_version','7.6.0','step_count',10,'has_investigation',false,'coverage',array['量热','速率对照','控制变量','平衡扰动','数据结论'])),
  ('E12','comprehensive','E12','滴定、盐类水解与沉淀平衡',2,760,'规范润洗、移液、滴定和重复测定。','通过pH和沉淀转化验证水解与溶度积关系。','酚酞终点恰好褪色，白色AgCl加入碘离子后转为黄色AgI。',jsonb_build_object('workflow_version','7.6.0','step_count',11,'has_investigation',false,'coverage',array['滴定准备','移液','终点','平行复测','水解','沉淀转化'])),
  ('E13','comprehensive','E13','电池、电解、腐蚀与资源回收',2,760,'锌、铜分别置于两个独立半池。','盐桥连接双半池，电解阶段在阴极回收金属并称量。','锌片溶解、铜极析出红色铜且电流表偏转；电解阴极增重。',jsonb_build_object('workflow_version','7.6.0','step_count',14,'has_investigation',false,'coverage',array['双半池','盐桥','外电路','电解','金属回收'])),
  ('E14','comprehensive','E14','煤、石油裂化与烃的性质',2,760,'石蜡油蒸气通过受热催化剂裂化。','产物经收集、溴水和高锰酸钾复验，并在导气管出口安全燃烧。','裂化气使溴水和酸性高锰酸钾褪色，燃烧产物使石灰水变浑浊。',jsonb_build_object('workflow_version','7.6.0','step_count',12,'has_investigation',false,'coverage',array['装配','气密性','裂化','收集','复验','导气管燃烧'])),
  ('E15','comprehensive','E15','乙醇—乙醛—乙酸—乙酸乙酯连续实验',2,760,'乙醇逐步氧化并完成中间产物检验。','酯化粗品依次洗涤、分液、干燥和蒸馏。','铜丝红黑交替、乙醛形成银镜，最终得到有香味且与水分层的无色液体。',jsonb_build_object('workflow_version','7.6.0','step_count',14,'has_investigation',false,'coverage',array['乙醇氧化','乙醛检验','乙酸生成','酯化','纯化'])),
  ('E16','comprehensive','E16','未知有机物官能团检验',2,760,'未知有机液必须分样，分别检验酸性、双键、醛基和酚羟基。','阳性与阴性结果共同用于官能团推断。','溴水褪色并形成银镜；与碳酸氢钠、氯化铁无特征现象。',jsonb_build_object('workflow_version','7.6.0','step_count',9,'has_investigation',true,'coverage',array['分样','阴性证据','双键检验','醛基复验','结构推断'])),
  ('E17','comprehensive','E17','有机合成路线与条件选择',3,760,'按路线完成回流反应并用薄层监测终点。','经萃取、洗涤、干燥、浓缩和重结晶得到纯品。','原料薄层斑点消失，重结晶后得到熔程较窄的晶体。',jsonb_build_object('workflow_version','7.6.0','step_count',13,'has_investigation',false,'coverage',array['回流','薄层','萃取','洗涤','干燥','重结晶','熔点'])),
  ('E18','comprehensive','E18','糖类、油脂、氨基酸与蛋白质',3,760,'设置互不干扰的糖、油脂和蛋白质微型实验。','糖水解复验前先中和，油脂皂化后盐析，蛋白质做双缩脲反应。','生成砖红色沉淀、皂化盐析固体和紫色双缩脲现象。',jsonb_build_object('workflow_version','7.6.0','step_count',12,'has_investigation',false,'coverage',array['糖水解','中和复验','皂化','盐析','蛋白质检验'])),
  ('E19','comprehensive','E19','高分子材料辨识、合成与回收',3,760,'用浮沉、受热和微量燃烧综合辨识未知塑料。','完成乙烯加聚模拟并按材料类别回收。','塑料表现特定浮沉和热行为，聚合后双键特征减弱并形成长链固体。',jsonb_build_object('workflow_version','7.6.0','step_count',10,'has_investigation',false,'coverage',array['材料辨识','热行为','加聚','谱图','分类回收'])),
  ('E20','comprehensive','E20','结构、配位与晶体综合',3,760,'氨水按少量、过量两阶段加入铜盐。','配合物溶液经浓缩、冷却、抽滤、洗涤和干燥得到晶体。','先出现浅蓝色沉淀，过量氨水后形成深蓝色溶液并析出深蓝晶体。',jsonb_build_object('workflow_version','7.6.0','step_count',11,'has_investigation',false,'coverage',array['分步配位','浓缩结晶','抽滤','洗涤','产率'])),
  ('E21','comprehensive','E21','环己烯制备、纯化与波谱证据',3,760,'逐件装配蒸馏装置并核对温度计与冷凝水方向。','粗品经洗涤、分液、干燥和结构复验。','得到与水分层的无色液体，可使溴水褪色，谱图支持双键生成。',jsonb_build_object('workflow_version','7.6.0','step_count',14,'has_investigation',false,'coverage',array['蒸馏装配','安全检查','脱水','洗涤分液','干燥','结构复验'])),
  ('E22','comprehensive','E22','信息迁移：狄尔斯—阿尔德与选择性合成',3,760,'选择共轭二烯和活化亲双烯体，在无水条件下回流。','以薄层、结晶、熔点和核磁证据判断产物选择性。','原料薄层斑点减弱，冰浴析晶，纯品熔程和核磁信号与题给结构相符。',jsonb_build_object('workflow_version','7.6.0','step_count',12,'has_investigation',false,'coverage',array['气氛','回流','薄层','结晶','熔点','核磁']))
on conflict (code) do update set
  module = excluded.module,
  chapter = excluded.chapter,
  title = excluded.title,
  difficulty = excluded.difficulty,
  version = excluded.version,
  reactant_features = excluded.reactant_features,
  product_features = excluded.product_features,
  phenomenon = excluded.phenomenon,
  metadata = excluded.metadata,
  active = true,
  updated_at = now();
