import React, { useState, useRef, useEffect } from 'react';
import { GoogleGenAI, GenerateContentResponse } from "@google/genai";
import { marked } from "marked";
import { 
    LogoIcon, ImpulsividadeIcon, ExpectativaIcon, ValorIcon, TempoIcon, 
    DiagnosticoIcon, EquacaoIcon, RecomendacaoIcon, AcaoIcon, CheckIcon,
    InfoIcon, LoadingSpinnerIcon, ArrowRightIcon, ChatIcon 
} from './components/icons';

type View = 'landing' | 'diagnostic';

const SYSTEM_INSTRUCTION = `Você é o "EquaçãoPro Assistant", um assistente especialista em Procrastinação, versão MVP 1.0. 
Sua base de conhecimento é a pesquisa científica de Piers Steel.
SEU OBJETIVO: Ajudar usuários a diagnosticar e superar a procrastinação usando a Equação da Procrastinação: Procrastinação = Impulsividade ÷ [Expectativa × Valor × (1 ÷ Tempo)].

PRINCÍPIOS FUNDAMENTAIS:
1. Use os dados fornecidos pelo usuário para o diagnóstico.
2. Use dados concretos e a equação, não motivação genérica.
3. Personalize recomendações para cada usuário.
4. Seja científico, não místico.

ESTRUTURA DE RESPOSTA PADRÃO (use markdown para formatar):
### **[DIAGNÓSTICO]**
Qual é o problema raiz com base na equação? (Seja direto e use os dados do usuário para justificar). Exemplo: "Sua procrastinação parece vir de uma **baixa Expectativa** de sucesso, pois você mencionou que não tem profundidade na prática, o que gera medo de errar e perder dinheiro."

### **[EQUAÇÃO]**
Como a fórmula se aplica ao problema do usuário? (Explique qual variável é o principal problema: Expectativa baixa, Valor baixo, ou Impulsividade alta / Prazo distante). Exemplo: "Sua **Expectativa** (confiança) está em 6/10, o que diminui drasticamente o denominador da equação e aumenta a procrastinação. Embora o **Valor** seja alto, a incerteza sobre sua capacidade de alcançá-lo o paralisa."

### **[RECOMENDAÇÃO]**
Qual variável da equação devemos ajustar e como? (Seja prático e focado na variável diagnosticada). Exemplo: "Precisamos aumentar sua **Expectativa**. A melhor forma de fazer isso não é com pensamento positivo, mas ganhando experiência prática controlada para reduzir o medo do fracasso."

### **[AÇÃO]**
Qual é a primeira ação concreta e pequena (estilo SMART) que o usuário pode tomar agora? (Deve ser algo que pode ser feito em menos de 30 minutos). Exemplo: "Crie uma campanha de teste com um orçamento mínimo (ex: R$10) em uma plataforma. O objetivo **não é ter lucro**, mas sim completar o ciclo de criação e publicação. Isso vai construir sua confiança e gerar dados reais para análise, aumentando sua **Expectativa** para o próximo passo."

RESTRIÇÕES:
-   Nunca prometa uma "solução mágica".
-   Nunca ignore barreiras reais que o usuário mencionar.
-   Nunca seja moralista sobre procrastinação.
-   Sempre siga a ESTRUTURA DE RESPOSTA PADRÃO.
-   Mantenha a resposta concisa e focada nos 4 pontos.`;

const questions = [
  {
    key: 'tarefa',
    icon: <ChatIcon className="w-6 h-6 text-indigo-500" />,
    title: 'Qual tarefa você está procrastinando?',
    subtitle: 'Seja específico. Exemplo: "Criar apresentação de vendas para cliente X"',
    placeholder: 'Descreva a tarefa em detalhes...',
  },
  {
    key: 'expectativa',
    icon: <ExpectativaIcon className="w-6 h-6 text-teal-500" />,
    title: 'Qual sua confiança de conseguir completar?',
    subtitle: 'De 0 a 10, quão capaz você se sente para fazer isso? Por quê?',
    placeholder: 'Exemplo: "6/10 - Tenho conhecimento, mas falta prática com a ferramenta..."',
  },
  {
    key: 'valor',
    icon: <ValorIcon className="w-6 h-6 text-amber-500" />,
    title: 'Qual o valor/recompensa desta tarefa?',
    subtitle: 'O que você ganha completando? Como isso ajuda seus objetivos?',
    placeholder: 'Exemplo: "Fechar contrato de R$50k, avançar na carreira, reduzir ansiedade..."',
  },
  {
    key: 'tempo',
    icon: <TempoIcon className="w-6 h-6 text-sky-500" />,
    title: 'Quando é o prazo? Qual sua relação com ele?',
    subtitle: 'Data limite e como você se sente sobre esse prazo.',
    placeholder: 'Exemplo: "Sexta-feira próxima. Parece distante, mas sei que é pouco tempo..."',
  },
  {
    key: 'impulsividade',
    icon: <ImpulsividadeIcon className="w-6 h-6 text-rose-500" />,
    title: 'O que te distrai desta tarefa?',
    subtitle: 'Liste suas principais fontes de distração e por que são atraentes.',
    placeholder: 'Exemplo: "Redes sociais, notificações, vídeos no YouTube. São fáceis e dão prazer imediato..."',
  },
];

const DiagnosticView = ({ backToLanding }: { backToLanding: () => void }) => {
    const [step, setStep] = useState(0);
    const [answers, setAnswers] = useState<Record<string, string>>({});
    const [isLoading, setIsLoading] = useState(false);
    const [result, setResult] = useState('');
    const [error, setError] = useState('');

    const currentQuestion = questions[step];
    const isLastStep = step === questions.length - 1;

    const handleNext = () => {
        if (answers[currentQuestion.key]?.trim()) {
            if (isLastStep) {
                handleSubmit();
            } else {
                setStep(step + 1);
            }
        }
    };

    const handleBack = () => {
        if (step > 0) {
            setStep(step - 1);
        }
    };

    const handleAnswerChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
        setAnswers({ ...answers, [currentQuestion.key]: e.target.value });
    };
    
    const handleSubmit = async () => {
        setIsLoading(true);
        setResult('');
        setError('');

        const prompt = `Aqui estão as respostas do usuário para o diagnóstico de procrastinação:
        - Tarefa: ${answers.tarefa}
        - Expectativa (Confiança): ${answers.expectativa}
        - Valor (Recompensa): ${answers.valor}
        - Tempo (Prazo): ${answers.tempo}
        - Impulsividade (Distrações): ${answers.impulsividade}

        Agora, gere o diagnóstico seguindo a estrutura de resposta padrão.`;

        try {
            if (!process.env.API_KEY) {
                throw new Error("API_KEY is not set.");
            }
            const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
            const response = await ai.models.generateContent({
                model: 'gemini-2.5-flash',
                contents: prompt,
                config: {
                    systemInstruction: SYSTEM_INSTRUCTION,
                },
            });
            setResult(response.text);
        } catch (err) {
            console.error(err);
            setError('Ocorreu um erro ao gerar o diagnóstico. Tente novamente.');
        } finally {
            setIsLoading(false);
        }
    };

    const startNewDiagnostic = () => {
      setStep(0);
      setAnswers({});
      setResult('');
      setError('');
    }

    if(isLoading) {
        return (
            <div className="flex flex-col items-center justify-center min-h-screen p-4 text-center">
                <LoadingSpinnerIcon className="w-12 h-12 text-indigo-500" />
                <h2 className="text-2xl font-bold mt-4 text-slate-800">Analisando suas respostas...</h2>
                <p className="text-slate-500 mt-2">O assistente está aplicando a Equação da Procrastinação ao seu caso.</p>
            </div>
        )
    }

    if (result || error) {
      return (
        <div className="min-h-screen p-4 md:p-8">
            <div className="max-w-3xl mx-auto">
                <button onClick={backToLanding} className="text-sm font-semibold text-slate-600 hover:text-slate-900 mb-4">&larr; Voltar ao Início</button>
                <h1 className="text-3xl font-extrabold text-slate-900 mb-2">Seu Diagnóstico Científico</h1>
                <p className="text-slate-500 mb-6">Aqui está a análise da sua procrastinação e um plano de ação concreto.</p>
                {result && <div className="p-6 bg-white rounded-lg shadow-md prose" dangerouslySetInnerHTML={{ __html: marked.parse(result) }} />}
                {error && <div className="p-4 text-red-700 bg-red-100 border border-red-400 rounded-md">{error}</div>}
                <button 
                  onClick={startNewDiagnostic}
                  className="mt-8 w-full md:w-auto flex items-center justify-center gap-2 px-6 py-3 bg-indigo-600 text-white font-semibold rounded-lg shadow-md hover:bg-indigo-700 transition-all transform hover:scale-105"
                >
                  Começar Novo Diagnóstico
                </button>
            </div>
        </div>
      );
    }


    return (
        <div className="min-h-screen p-4 flex flex-col justify-center">
            <div className="max-w-xl mx-auto w-full">
                <header className="flex items-center justify-between mb-8">
                    <button onClick={backToLanding} className="text-sm font-semibold text-slate-600 hover:text-slate-900">&larr; Voltar</button>
                    <div className="flex items-center gap-2">
                        <LogoIcon className="w-6 h-6 text-indigo-500" />
                        <span className="font-bold text-slate-800">EquaçãoPro</span>
                    </div>
                    <span className="text-sm font-semibold text-slate-500">{step + 1}/{questions.length}</span>
                </header>
                
                <div className="bg-white p-8 rounded-xl shadow-lg border border-slate-200">
                    <div className="flex items-start gap-4 mb-4">
                        <div className="bg-slate-100 p-2 rounded-lg">{currentQuestion.icon}</div>
                        <div>
                            <h2 className="text-xl font-bold text-slate-800">{currentQuestion.title}</h2>
                            <p className="text-sm text-slate-500">{currentQuestion.subtitle}</p>
                        </div>
                    </div>

                    <textarea
                        value={answers[currentQuestion.key] || ''}
                        onChange={handleAnswerChange}
                        placeholder={currentQuestion.placeholder}
                        className="w-full p-3 mt-4 border border-slate-300 rounded-lg h-36 resize-none focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                    />
                    <p className="text-xs text-slate-400 mt-2">Seja honesto e específico. Quanto mais detalhes, melhor o diagnóstico.</p>
                </div>

                 <div className="mt-6 flex gap-4">
                    <button
                        onClick={handleBack}
                        disabled={step === 0}
                        className="flex-1 py-3 px-6 bg-white border border-slate-300 rounded-lg font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                        Anterior
                    </button>
                    <button
                        onClick={handleNext}
                        disabled={!answers[currentQuestion.key]?.trim()}
                        className="flex-1 py-3 px-6 bg-indigo-600 text-white rounded-lg font-semibold hover:bg-indigo-700 disabled:bg-indigo-300 disabled:cursor-not-allowed transition-colors"
                    >
                        {isLastStep ? 'Gerar Diagnóstico' : 'Próxima'}
                    </button>
                </div>
                 {!answers[currentQuestion.key]?.trim() && <p className="text-center text-sm text-amber-600 mt-4">🔥 Escreva pelo menos uma frase completa para continuar.</p>}
                 <div className="mt-8 p-4 bg-slate-100 rounded-lg flex items-start gap-3">
                    <InfoIcon className="w-5 h-5 text-slate-500 mt-0.5 flex-shrink-0"/>
                    <p className="text-xs text-slate-500">Cada pergunta mapeia uma variável da Equação da Procrastinação de Piers Steel. Com suas respostas, identificaremos qual variável está causando sua procrastinação e forneceremos ações concretas e personalizadas.</p>
                </div>
            </div>
        </div>
    );
};


const LandingView = ({ startDiagnostic }: { startDiagnostic: () => void }) => {
    return (
        <div className="w-full gradient-bg">
            <header className="p-4">
                <div className="max-w-6xl mx-auto flex items-center gap-2">
                    <LogoIcon className="w-7 h-7 text-indigo-600" />
                    <span className="text-lg font-bold text-slate-800">EquaçãoPro</span>
                    <span className="text-xs font-semibold bg-slate-200 text-slate-600 px-2 py-0.5 rounded-full ml-1">Baseado em ciência</span>
                </div>
            </header>
            
            <main className="py-12 md:py-20 px-4">
                <div className="max-w-3xl mx-auto text-center">
                    <h1 className="text-4xl md:text-6xl font-extrabold text-slate-900 leading-tight">
                        Supere a <span className="text-transparent bg-clip-text bg-gradient-to-r from-teal-400 to-indigo-600">Procrastinação</span>
                    </h1>

                    <div className="my-8 p-6 bg-white/70 backdrop-blur-sm rounded-xl shadow-lg border border-slate-200 text-left">
                        <p className="text-sm font-semibold text-slate-600">A Equação da Procrastinação</p>
                        <p className="text-lg md:text-xl font-mono text-slate-800 mt-2">
                            <span className="text-rose-600">Procrastinação</span> = <span className="text-rose-600">Impulsividade</span> ÷ [<span className="text-teal-600">Expectativa</span> × <span className="text-amber-600">Valor</span> × (1 ÷ <span className="text-sky-600">Tempo</span>)]
                        </p>
                    </div>

                    <p className="max-w-2xl mx-auto text-lg text-slate-600">
                        Um assistente científico que diagnostica e resolve seu problema de procrastinação usando dados concretos, não motivação genérica.
                    </p>

                    <div className="mt-10 flex flex-col sm:flex-row justify-center items-center gap-4">
                        <button 
                            onClick={startDiagnostic}
                            className="w-full sm:w-auto flex items-center justify-center gap-2 px-8 py-4 bg-gradient-to-r from-indigo-600 to-teal-500 text-white font-bold rounded-lg shadow-lg hover:shadow-xl transform hover:scale-105 transition-all"
                        >
                            Começar Diagnóstico
                            <ArrowRightIcon className="w-5 h-5"/>
                        </button>
                        <button 
                             onClick={() => document.getElementById('como-funciona')?.scrollIntoView({ behavior: 'smooth' })}
                            className="w-full sm:w-auto px-8 py-4 bg-white text-slate-700 font-semibold rounded-lg border border-slate-300 hover:bg-slate-50 transition-colors"
                        >
                            Como Funciona
                        </button>
                    </div>
                    
                    <div className="mt-8 text-sm text-slate-500 flex justify-center items-center gap-4 flex-wrap">
                       <span className="flex items-center gap-1.5"><CheckIcon className="w-4 h-4 text-teal-500"/> Método científico validado</span>
                       <span className="flex items-center gap-1.5"><CheckIcon className="w-4 h-4 text-teal-500"/> Sem jargão motivacional</span>
                       <span className="flex items-center gap-1.5"><CheckIcon className="w-4 h-4 text-teal-500"/> Ações práticas e mensuráveis</span>
                    </div>
                </div>

                <section id="variaveis" className="max-w-5xl mx-auto mt-20 md:mt-32">
                    <h2 className="text-3xl font-bold text-center text-slate-800">Entenda as Variáveis</h2>
                    <p className="text-center mt-2 text-slate-600">A procrastinação não é preguiça. É uma equação matemática que você pode controlar.</p>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mt-10">
                        <div className="bg-white p-6 rounded-lg border border-slate-200 shadow-sm">
                            <div className="flex items-center gap-3">
                                <ImpulsividadeIcon className="w-7 h-7 text-rose-500" />
                                <h3 className="text-xl font-bold text-slate-800">Impulsividade</h3>
                            </div>
                            <p className="mt-2 text-slate-600">Sua tendência a distrações e gratificação imediata.</p>
                            <span className="mt-4 inline-block text-sm font-semibold bg-rose-100 text-rose-700 px-3 py-1 rounded-full">↑ Aumenta procrastinação</span>
                        </div>
                         <div className="bg-white p-6 rounded-lg border border-slate-200 shadow-sm">
                            <div className="flex items-center gap-3">
                                <ExpectativaIcon className="w-7 h-7 text-teal-500" />
                                <h3 className="text-xl font-bold text-slate-800">Expectativa</h3>
                            </div>
                            <p className="mt-2 text-slate-600">Sua confiança de que conseguirá completar a tarefa.</p>
                            <span className="mt-4 inline-block text-sm font-semibold bg-teal-100 text-teal-700 px-3 py-1 rounded-full">↓ Reduz procrastinação</span>
                        </div>
                         <div className="bg-white p-6 rounded-lg border border-slate-200 shadow-sm">
                            <div className="flex items-center gap-3">
                                <ValorIcon className="w-7 h-7 text-amber-500" />
                                <h3 className="text-xl font-bold text-slate-800">Valor</h3>
                            </div>
                            <p className="mt-2 text-slate-600">Quão recompensadora é a tarefa para você.</p>
                            <span className="mt-4 inline-block text-sm font-semibold bg-teal-100 text-teal-700 px-3 py-1 rounded-full">↓ Reduz procrastinação</span>
                        </div>
                         <div className="bg-white p-6 rounded-lg border border-slate-200 shadow-sm">
                            <div className="flex items-center gap-3">
                                <TempoIcon className="w-7 h-7 text-sky-500" />
                                <h3 className="text-xl font-bold text-slate-800">Tempo</h3>
                            </div>
                            <p className="mt-2 text-slate-600">Quanto tempo até o prazo final.</p>
                             <span className="mt-4 inline-block text-sm font-semibold bg-rose-100 text-rose-700 px-3 py-1 rounded-full">↑ Aumenta procrastinação</span>
                        </div>
                    </div>
                     <div className="mt-6 p-4 bg-slate-100 rounded-lg text-center text-slate-600">
                        <p><strong>A chave:</strong> Aumentar Expectativa e Valor, reduzir Impulsividade, e criar urgência saudável diminuindo o Tempo percebido.</p>
                    </div>
                </section>

                <section id="como-funciona" className="max-w-6xl mx-auto mt-20 md:mt-32">
                     <h2 className="text-3xl font-bold text-center text-slate-800">Como Funciona</h2>
                    <p className="text-center mt-2 text-slate-600">Quatro passos baseados em ciência comportamental, não em motivação superficial.</p>
                    <div className="relative mt-12">
                      <div className="hidden md:block absolute top-1/2 left-0 w-full h-0.5 bg-slate-200 -translate-y-1/2"></div>
                      <div className="relative grid grid-cols-1 md:grid-cols-4 gap-8">
                          <div className="text-center bg-white p-6 rounded-lg border border-slate-200 shadow-sm">
                              <div className="w-16 h-16 mx-auto bg-slate-100 rounded-lg flex items-center justify-center"><DiagnosticoIcon className="w-8 h-8 text-indigo-500" /></div>
                              <p className="text-xs mt-4 font-bold text-slate-400">01</p>
                              <h3 className="text-xl font-bold text-slate-800">Diagnóstico</h3>
                              <p className="text-sm text-slate-500 mt-1">Respondemos perguntas específicas sobre seu contexto e tarefa.</p>
                          </div>
                          <div className="text-center bg-white p-6 rounded-lg border border-slate-200 shadow-sm">
                              <div className="w-16 h-16 mx-auto bg-slate-100 rounded-lg flex items-center justify-center"><EquacaoIcon className="w-8 h-8 text-teal-500" /></div>
                              <p className="text-xs mt-4 font-bold text-slate-400">02</p>
                              <h3 className="text-xl font-bold text-slate-800">Equação</h3>
                              <p className="text-sm text-slate-500 mt-1">Analisamos suas respostas através da fórmula científica.</p>
                          </div>
                           <div className="text-center bg-white p-6 rounded-lg border border-slate-200 shadow-sm">
                              <div className="w-16 h-16 mx-auto bg-slate-100 rounded-lg flex items-center justify-center"><RecomendacaoIcon className="w-8 h-8 text-amber-500" /></div>
                              <p className="text-xs mt-4 font-bold text-slate-400">03</p>
                              <h3 className="text-xl font-bold text-slate-800">Recomendação</h3>
                              <p className="text-sm text-slate-500 mt-1">Identificamos qual variável intervir para máximo impacto.</p>
                          </div>
                          <div className="text-center bg-white p-6 rounded-lg border border-slate-200 shadow-sm">
                              <div className="w-16 h-16 mx-auto bg-slate-100 rounded-lg flex items-center justify-center"><AcaoIcon className="w-8 h-8 text-sky-500" /></div>
                              <p className="text-xs mt-4 font-bold text-slate-400">04</p>
                              <h3 className="text-xl font-bold text-slate-800">Ação</h3>
                              <p className="text-sm text-slate-500 mt-1">Recebe passos concretos e mensuráveis para executar agora.</p>
                          </div>
                      </div>
                    </div>
                     <p className="text-center italic text-slate-500 mt-12">"A procrastinação é uma equação. Mude as variáveis e você muda o resultado." <br/> — Piers Steel, PhD</p>
                </section>
            </main>
            <footer className="mt-20 border-t border-slate-200 py-8 px-4">
              <div className="max-w-6xl mx-auto text-center text-sm text-slate-500 sm:flex sm:justify-between sm:items-center">
                <div className="flex items-center justify-center gap-2">
                  <LogoIcon className="w-6 h-6 text-slate-400" />
                  <p><strong>EquaçãoPro</strong> | Baseado na pesquisa científica de Piers Steel</p>
                </div>
                <p className="mt-2 sm:mt-0">&copy; 2024 EquaçãoPro Assistant. MVP 1.0 - Diagnóstico Científico de Procrastinação.</p>
              </div>
            </footer>
        </div>
    );
}


const App: React.FC = () => {
    const [view, setView] = useState<View>('landing');

    const startDiagnostic = () => setView('diagnostic');
    const backToLanding = () => setView('landing');

    if (view === 'landing') {
        return <LandingView startDiagnostic={startDiagnostic} />;
    }

    return <DiagnosticView backToLanding={backToLanding} />;
};

export default App;