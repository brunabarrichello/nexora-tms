import { FormPage } from '../../../_components/form-page';
export const metadata = { title: 'Novo cliente' };
export default function Page() { return <FormPage eyebrow="Cadastros • Clientes" title="Novo cliente" description="Cadastro comercial preparado para cargas, negociação, faturamento e documentos." backHref="/cadastros/clientes" groups={[
  {title:'Identificação',description:'Dados cadastrais e classificação comercial.',fields:[{name:'name',label:'Razão social / nome',required:true,wide:true},{name:'tradeName',label:'Nome fantasia'},{name:'document',label:'CNPJ/CPF',required:true},{name:'type',label:'Tipo',options:['Embarcador','Contratante','Destinatário'],required:true},{name:'status',label:'Status',options:['Ativo','Inativo','Bloqueado'],required:true}]},
  {title:'Contato',description:'Contatos principais para operação e financeiro.',fields:[{name:'email',label:'E-mail',type:'email'},{name:'phone',label:'Telefone',type:'tel'},{name:'contactName',label:'Contato principal'},{name:'billingEmail',label:'E-mail financeiro',type:'email'}]},
  {title:'Endereço principal',description:'Base para coleta, entrega e faturamento.',fields:[{name:'zipCode',label:'CEP'},{name:'street',label:'Logradouro',wide:true},{name:'number',label:'Número'},{name:'district',label:'Bairro'},{name:'city',label:'Cidade',required:true},{name:'state',label:'UF',required:true}]},
 ]} />; }
